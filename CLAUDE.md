# CLAUDE.md

Whenever developing code, always reference the specifications document locted here: ./shopify_audio_store_specifications.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Shopify theme development project for "CHT Solutions", a high-end audio and home theatre equipment retailer. The project implements the "Acoustic" theme specification designed for premium audio retailers.

## Commands

### Development
```bash
# Install dependencies (for scraper tool)
npm install

# Run the web scraper to update content from live site
node scraper.js
```

### Testing
No test framework is currently configured. The package.json test script exits with an error.

## Architecture

### Theme Structure
The theme follows Shopify 2.0 architecture with these key components:

- **Layout**: `theme.liquid` serves as the main wrapper for all pages
- **Sections**: Modular, customizable components (hero, header, footer, product grids, etc.) that can be reordered via Shopify admin
- **Templates**: JSON-based page templates that define which sections appear on specific page types
- **Snippets**: Small reusable components like product cards and price displays

### Key Implementation Details

1. **Product Pages** (`sections/main-product.liquid`):
   - Uses Shopify's media API for product images/videos
   - Implements variant selection with JavaScript
   - Includes structured data for SEO
   - Supports metafields for technical specifications

2. **Collection Pages** (`sections/main-collection.liquid`):
   - Implements product filtering and sorting
   - Uses pagination for large collections
   - Responsive grid layout

3. **Global Components**:
   - Header (`sections/header.liquid`): Sticky navigation with search, cart, and account links
   - Footer (`sections/footer.liquid`): Multi-column layout with newsletter signup and payment icons

4. **Content Scraper** (`scraper.js`):
   - Puppeteer-based tool to extract content from the live CHT Solutions website
   - Converts HTML to Markdown and organizes by content type
   - Useful for content migration during theme development

### Shopify Liquid Patterns
- Use `{{ section.settings.* }}` for customizable options
- Implement `{% schema %}` blocks for section configuration
- Follow Shopify's handle conventions for URLs and identifiers
- Use `assign` for variable declarations and `capture` for complex HTML blocks

### CSS/JS Organization
- Global styles in `assets/application.css`
- Interactive functionality in `assets/application.js`
- Follow BEM naming convention for CSS classes
- Use Shopify's theme editor CSS variables for customizable colors/fonts