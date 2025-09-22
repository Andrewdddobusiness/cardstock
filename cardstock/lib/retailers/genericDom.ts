import * as cheerio from "cheerio";
import { NormalizedProduct } from "./index";

export async function checkGenericDom(url: string): Promise<NormalizedProduct> {
  const res = await fetch(url, { 
    headers: { 
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
    } 
  });
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Extract title
  const title = 
    $('meta[property="og:title"]').attr("content") || 
    $("h1").first().text().trim() || 
    $("title").text().trim() ||
    "Unknown Product";
  
  // Check if product can be added to cart
  const addToCart = 
    $("button:contains('Add to cart'):not([disabled])").length > 0 ||
    $("button:contains('Add to Cart'):not([disabled])").length > 0 ||
    $("button:contains('Buy Now'):not([disabled])").length > 0 ||
    $("button:contains('Add to bag'):not([disabled])").length > 0;
  
  // Try to extract price
  const priceSelectors = [
    ".price",
    '[data-testid="price"]',
    '[itemprop="price"]',
    'meta[itemprop="price"]',
    '.product-price',
    '.Price',
    '[class*="price"]:not([class*="was"])'
  ];
  
  let priceStr = "";
  for (const selector of priceSelectors) {
    const element = $(selector).first();
    if (element.length) {
      priceStr = element.attr("content") || element.text() || "";
      if (priceStr) break;
    }
  }
  
  const price = priceStr ? parseFloat(priceStr.replace(/[^0-9.]/g, "")) : null;
  
  return { 
    retailer: new URL(url).hostname.replace("www.", ""), 
    productUrl: url, 
    productTitle: title, 
    variants: [{ 
      price, 
      inStock: addToCart 
    }]
  };
}