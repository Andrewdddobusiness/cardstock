import * as cheerio from "cheerio";
import { NormalizedProduct } from "./index";

export async function checkGenericDom(url: string): Promise<NormalizedProduct> {
  try {
    const res = await fetch(url, { 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      } 
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Extract title with more options
    const title = 
      $('meta[property="og:title"]').attr("content") || 
      $('meta[name="twitter:title"]').attr("content") ||
      $("h1").first().text().trim() || 
      $('[data-testid*="title"]').first().text().trim() ||
      $(".product-title").first().text().trim() ||
      $("title").text().trim() ||
      "Unknown Product";
    
    // Enhanced add to cart detection
    const addToCartSelectors = [
      "button:contains('Add to cart'):not([disabled]):not(.disabled)",
      "button:contains('Add to Cart'):not([disabled]):not(.disabled)", 
      "button:contains('Buy Now'):not([disabled]):not(.disabled)",
      "button:contains('Add to bag'):not([disabled]):not(.disabled)",
      "button:contains('Purchase'):not([disabled]):not(.disabled)",
      "button:contains('Pre-order'):not([disabled]):not(.disabled)",
      '[data-testid*="add"]:not([disabled]):not(.disabled)',
      '[data-testid*="cart"]:not([disabled]):not(.disabled)',
      '.add-to-cart:not([disabled]):not(.disabled)',
      '#add-to-cart:not([disabled]):not(.disabled)',
      'input[type="submit"][value*="Add"]:not([disabled]):not(.disabled)'
    ];
    
    let addToCart = false;
    for (const selector of addToCartSelectors) {
      if ($(selector).length > 0) {
        addToCart = true;
        break;
      }
    }
    
    // Check for out of stock indicators
    const outOfStockIndicators = [
      "out of stock",
      "sold out", 
      "unavailable",
      "notify me when available",
      "currently unavailable",
      "temporarily out of stock"
    ];
    
    const pageText = $('body').text().toLowerCase();
    const hasOutOfStockText = outOfStockIndicators.some(indicator => 
      pageText.includes(indicator)
    );
    
    // If we found out of stock text, override the button check
    if (hasOutOfStockText) {
      addToCart = false;
    }
    
    // Enhanced price extraction
    const priceSelectors = [
      '.price:not(.was-price):not(.old-price)',
      '.current-price',
      '.sale-price', 
      '.product-price',
      '.Price',
      '[data-testid*="price"]',
      '[itemprop="price"]',
      'meta[itemprop="price"]',
      '.price-current',
      '.price-now',
      '[class*="price"]:not([class*="was"]):not([class*="old"])',
      '.cost',
      '.amount'
    ];
    
    let priceStr = "";
    for (const selector of priceSelectors) {
      const element = $(selector).first();
      if (element.length) {
        priceStr = element.attr("content") || element.text() || "";
        // Clean and validate price string
        const cleanPrice = priceStr.replace(/[^\d.,]/g, "");
        if (cleanPrice && cleanPrice.length > 0) {
          priceStr = cleanPrice;
          break;
        }
      }
    }
    
    // Better price parsing
    let price: number | null = null;
    if (priceStr) {
      // Handle different decimal separators and thousands separators
      const normalizedPrice = priceStr.replace(/,/g, "");
      const parsed = parseFloat(normalizedPrice);
      if (!isNaN(parsed) && parsed > 0) {
        price = parsed;
      }
    }
    
    return { 
      retailer: new URL(url).hostname.replace("www.", ""), 
      productUrl: url, 
      productTitle: title.trim(), 
      variants: [{ 
        price, 
        inStock: addToCart 
      }]
    };
    
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    
    // Return a fallback result instead of throwing
    return {
      retailer: new URL(url).hostname.replace("www.", ""),
      productUrl: url,
      productTitle: "Error loading product",
      variants: [{
        price: null,
        inStock: false
      }]
    };
  }
}