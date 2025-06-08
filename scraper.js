const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        console.error(`Error creating directory ${dirPath}:`, error);
    }
}

async function scrapePageContent(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for main content to load
        await page.waitForSelector('body', { timeout: 10000 });
        
        // Extract readable content
        const content = await page.evaluate(() => {
            // Remove script and style elements
            const scripts = document.querySelectorAll('script, style, noscript');
            scripts.forEach(el => el.remove());
            
            // Get page title
            const title = document.title || 'Untitled';
            
            // Get main content
            let mainContent = '';
            
            // Try to find main content areas
            const contentSelectors = ['main', 'article', '.content', '#content', '.main-content', '[role="main"]'];
            for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    mainContent = element.innerText;
                    break;
                }
            }
            
            // If no main content found, get body text
            if (!mainContent) {
                mainContent = document.body.innerText;
            }
            
            // Get navigation links if available
            const navLinks = [];
            const navElements = document.querySelectorAll('nav a, .navigation a, .menu a');
            navElements.forEach(link => {
                const text = link.innerText.trim();
                const href = link.href;
                if (text && href) {
                    navLinks.push(`- [${text}](${href})`);
                }
            });
            
            return {
                title,
                content: mainContent,
                navigation: navLinks
            };
        });
        
        return content;
    } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return null;
    }
}

async function saveContentToMarkdown(content, filename, url) {
    if (!content) return;
    
    const markdown = `# ${content.title}

**Source URL:** ${url}

## Content

${content.content}

${content.navigation.length > 0 ? `## Navigation Links\n\n${content.navigation.join('\n')}` : ''}
`;
    
    await fs.writeFile(filename, markdown, 'utf8');
    console.log(`Saved: ${filename}`);
}

async function scrapeWebsite() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set user agent to avoid blocking
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Create directories
    await ensureDirectoryExists('scraped_content');
    await ensureDirectoryExists('scraped_content/pages');
    await ensureDirectoryExists('scraped_content/categories');
    await ensureDirectoryExists('scraped_content/products');
    
    const baseUrl = 'https://customht.com.au';
    
    // First, scrape the homepage to find links
    console.log('Scraping homepage...');
    const homepageContent = await scrapePageContent(page, baseUrl);
    await saveContentToMarkdown(homepageContent, 'scraped_content/pages/homepage.md', baseUrl);
    
    // Get all links from the page
    const links = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        return allLinks.map(link => ({
            href: link.href,
            text: link.innerText.trim()
        })).filter(link => link.href && link.text);
    });
    
    // Categorize links
    const categoryLinks = [];
    const productLinks = [];
    const auxiliaryLinks = [];
    
    links.forEach(link => {
        const url = link.href.toLowerCase();
        if (url.includes('/collections/') || url.includes('/category/') || url.includes('/shop/')) {
            categoryLinks.push(link);
        } else if (url.includes('/products/') || url.includes('/product/')) {
            productLinks.push(link);
        } else if (url.includes('/pages/') || url.includes('about') || url.includes('contact') || 
                   url.includes('faq') || url.includes('terms') || url.includes('privacy')) {
            auxiliaryLinks.push(link);
        }
    });
    
    // Scrape auxiliary pages
    console.log('\nScraping auxiliary pages...');
    const auxiliaryPages = [
        { url: `${baseUrl}/pages/about-us`, name: 'about-us' },
        { url: `${baseUrl}/pages/contact`, name: 'contact' },
        { url: `${baseUrl}/pages/contact-us`, name: 'contact-us' },
        { url: `${baseUrl}/pages/faq`, name: 'faq' },
        { url: `${baseUrl}/pages/terms-of-service`, name: 'terms-of-service' },
        { url: `${baseUrl}/pages/privacy-policy`, name: 'privacy-policy' },
        { url: `${baseUrl}/pages/shipping-policy`, name: 'shipping-policy' },
        { url: `${baseUrl}/pages/returns`, name: 'returns' }
    ];
    
    for (const auxPage of auxiliaryPages) {
        console.log(`Attempting to scrape: ${auxPage.url}`);
        const content = await scrapePageContent(page, auxPage.url);
        if (content) {
            await saveContentToMarkdown(content, `scraped_content/pages/${auxPage.name}.md`, auxPage.url);
        }
    }
    
    // Try common Shopify collection URLs
    console.log('\nScraping category pages...');
    const categoryUrls = [
        `${baseUrl}/collections/all`,
        `${baseUrl}/collections/frontpage`,
        `${baseUrl}/collections/best-sellers`,
        `${baseUrl}/collections/new-arrivals`,
        `${baseUrl}/collections/sale`,
        ...categoryLinks.slice(0, 5).map(link => link.href)
    ];
    
    // Remove duplicates
    const uniqueCategoryUrls = [...new Set(categoryUrls)];
    
    let categoryCount = 0;
    for (const categoryUrl of uniqueCategoryUrls) {
        if (categoryCount >= 5) break;
        console.log(`Scraping category: ${categoryUrl}`);
        const content = await scrapePageContent(page, categoryUrl);
        if (content) {
            const filename = categoryUrl.split('/').pop() || 'category';
            await saveContentToMarkdown(content, `scraped_content/categories/${filename}.md`, categoryUrl);
            categoryCount++;
        }
    }
    
    // If we need more categories, try to find them from the navigation
    if (categoryCount < 5) {
        const navCategories = await page.evaluate(() => {
            const navLinks = document.querySelectorAll('nav a, .site-nav a, .menu a');
            return Array.from(navLinks)
                .map(link => link.href)
                .filter(href => href.includes('/collections/'));
        });
        
        for (const catUrl of navCategories) {
            if (categoryCount >= 5) break;
            if (!uniqueCategoryUrls.includes(catUrl)) {
                console.log(`Scraping additional category: ${catUrl}`);
                const content = await scrapePageContent(page, catUrl);
                if (content) {
                    const filename = catUrl.split('/').pop() || 'category';
                    await saveContentToMarkdown(content, `scraped_content/categories/${filename}-${categoryCount}.md`, catUrl);
                    categoryCount++;
                }
            }
        }
    }
    
    // Scrape product pages
    console.log('\nScraping product pages...');
    
    // First try to get products from a collection page
    if (uniqueCategoryUrls.length > 0) {
        await page.goto(uniqueCategoryUrls[0], { waitUntil: 'networkidle2' });
        const collectionProducts = await page.evaluate(() => {
            const productLinks = document.querySelectorAll('a[href*="/products/"]');
            return Array.from(productLinks).map(link => link.href).slice(0, 5);
        });
        
        let productCount = 0;
        for (const productUrl of collectionProducts) {
            if (productCount >= 3) break;
            console.log(`Scraping product: ${productUrl}`);
            const content = await scrapePageContent(page, productUrl);
            if (content) {
                const filename = productUrl.split('/').pop() || 'product';
                await saveContentToMarkdown(content, `scraped_content/products/${filename}.md`, productUrl);
                productCount++;
            }
        }
    }
    
    await browser.close();
    console.log('\nScraping completed!');
}

// Run the scraper
scrapeWebsite().catch(console.error);