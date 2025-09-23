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
    
    // BIG W specific stock detection with priority system
    let inStock = false;
    let isPreorder = false;
    
    // PRIORITY 1: Check for preorder indicators
    const preorderIndicators = [
      // Check for PRE-ORDER badge/text
      $('span:contains("PRE-ORDER"), div:contains("PRE-ORDER"), .pre-order').length > 0,
      // Check for RELEASES text with dates
      $('*:contains("RELEASES")').length > 0,
      // Check for Pre-order Price Guarantee
      $('*:contains("Pre-order Price Guarantee")').length > 0,
      // Check for preorder buttons
      $('button:contains("Pre-order"), button:contains("Pre-Order")').not('[disabled]').not('.disabled').length > 0
    ];
    
    if (preorderIndicators.some(indicator => indicator)) {
      inStock = true;
      isPreorder = true;
    } else {
      // PRIORITY 2: Check for Add to Cart/Wishlist availability (only if not preorder)
      const availabilitySelectors = [
        '[data-testid="add-to-cart"]',
        'button[aria-label*="Add to cart"]',
        'button:contains("Add to cart")',
        'button:contains("Add to Cart")',
        'button:contains("Add to wishlist")',
        'button:contains("Add to Wishlist")',
        '.add-to-cart-button',
        '.add-to-wishlist'
      ];
      
      const hasAvailabilityButton = availabilitySelectors.some(selector => 
        $(selector).not('[disabled]').not('.disabled').length > 0
      );
      
      if (hasAvailabilityButton) {
        inStock = true;
      }
      // PRIORITY 3: If no preorder and no add to cart, then out of stock
      // (inStock remains false by default)
    }
    
    return {
      retailer: "bigw.com.au",
      productUrl: url,
      productTitle: title,
      variants: [{
        price,
        inStock,
        isPreorder
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
        inStock: false,
        isPreorder: false
      }]
    };
  }
}