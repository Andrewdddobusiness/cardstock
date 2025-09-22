import * as cheerio from "cheerio";
import { NormalizedProduct } from "./index";

export async function checkBigW(url: string): Promise<NormalizedProduct> {
  try {
    const res = await fetch(url, { 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
        "Referer": "https://www.bigw.com.au/"
      } 
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // BIG W specific title extraction
    const title = 
      $('h1[data-testid="product-title"]').text().trim() ||
      $('meta[property="og:title"]').attr("content") || 
      $("h1").first().text().trim() || 
      "Unknown Product";
    
    // BIG W specific price extraction
    let price: number | null = null;
    const priceSelectors = [
      '[data-testid="product-price"]',
      '.price-current',
      '.Price',
      '.product-price'
    ];
    
    for (const selector of priceSelectors) {
      const priceText = $(selector).first().text().trim();
      if (priceText) {
        const priceMatch = priceText.match(/[\d.,]+/);
        if (priceMatch) {
          const parsed = parseFloat(priceMatch[0].replace(/,/g, ""));
          if (!isNaN(parsed) && parsed > 0) {
            price = parsed;
            break;
          }
        }
      }
    }
    
    // BIG W specific stock detection
    let inStock = false;
    
    // Check for add to cart button
    const addToCartButton = $('[data-testid="add-to-cart"], button:contains("Add to Cart"), button:contains("Add to cart")').not('[disabled]').not('.disabled');
    if (addToCartButton.length > 0) {
      inStock = true;
    }
    
    // Check for pre-order
    const preOrderButton = $('button:contains("Pre-order"), button:contains("Pre-Order")').not('[disabled]').not('.disabled');
    if (preOrderButton.length > 0) {
      inStock = true; // Treat pre-order as available
    }
    
    // Check for out of stock indicators
    const outOfStockIndicators = [
      "out of stock",
      "sold out",
      "unavailable", 
      "notify me",
      "currently unavailable"
    ];
    
    const pageText = $('body').text().toLowerCase();
    const hasOutOfStockText = outOfStockIndicators.some(indicator => 
      pageText.includes(indicator)
    );
    
    if (hasOutOfStockText) {
      inStock = false;
    }
    
    return {
      retailer: "bigw.com.au",
      productUrl: url,
      productTitle: title,
      variants: [{
        price,
        inStock
      }]
    };
    
  } catch (error) {
    console.error(`Error scraping BIG W product ${url}:`, error);
    
    return {
      retailer: "bigw.com.au",
      productUrl: url,
      productTitle: "Error loading product",
      variants: [{
        price: null,
        inStock: false
      }]
    };
  }
}