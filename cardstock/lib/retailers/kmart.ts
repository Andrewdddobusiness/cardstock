import * as cheerio from "cheerio";
import { NormalizedProduct } from "./index";

export async function checkKmart(url: string): Promise<NormalizedProduct> {
  try {
    const res = await fetch(url, { 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
        "Referer": "https://www.kmart.com.au/"
      } 
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Kmart specific title extraction
    const title = 
      $('h1[data-automation="product-title"]').text().trim() ||
      $('meta[property="og:title"]').attr("content") || 
      $("h1").first().text().trim() || 
      "Unknown Product";
    
    // Kmart specific price extraction
    let price: number | null = null;
    const priceSelectors = [
      '[data-automation="product-price"]',
      '.price',
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
    
    // Kmart specific stock detection with priority system
    let inStock = false;
    let isInStoreOnly = false;
    
    // PRIORITY 1: Check for "In Store Only" indicators
    const inStoreOnlyIndicators = [
      $('*:contains("In Store Only")').length > 0,
      $('*:contains("In-Store Only")').length > 0,
      $('*:contains("Available in store")').length > 0,
      $('*:contains("Check stock at")').length > 0,
      $('[data-automation*="store-only"]').length > 0
    ];
    
    if (inStoreOnlyIndicators.some(indicator => indicator)) {
      inStock = true;
      isInStoreOnly = true;
    } else {
      // PRIORITY 2: Check for online add to cart availability
      const addToCartButton = $('[data-automation="add-to-cart"], button:contains("Add to Cart"), button:contains("Add to cart")').not('[disabled]').not('.disabled');
      if (addToCartButton.length > 0) {
        inStock = true;
      } else {
        // PRIORITY 3: Check for explicit out of stock indicators
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
      }
    }
    
    return {
      retailer: "kmart.com.au",
      productUrl: url,
      productTitle: title,
      variants: [{
        price,
        inStock,
        isInStoreOnly
      }]
    };
    
  } catch (error) {
    console.error(`Error scraping Kmart product ${url}:`, error);
    
    return {
      retailer: "kmart.com.au",
      productUrl: url,
      productTitle: "Error loading product",
      variants: [{
        price: null,
        inStock: false
      }]
    };
  }
}