import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { NormalizedProduct } from "./index";

class CloudflareChallengeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareChallengeError";
  }
}

function sanitizePrice(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = value.match(/[\d.,]+/);
  if (!match) return null;
  const parsed = parseFloat(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseLdAvailability(data: unknown, collector: Set<string>) {
  if (!data) return;

  if (typeof data === "string") {
    collector.add(data);
    return;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      parseLdAvailability(item, collector);
    }
    return;
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.availability) parseLdAvailability(obj.availability, collector);
    if (obj.itemAvailability) parseLdAvailability(obj.itemAvailability, collector);
    if (obj.offers) parseLdAvailability(obj.offers, collector);
  }
}

function detectCloudflareInterception(html: string, $: cheerio.CheerioAPI): boolean {
  const title = $("title").first().text().toLowerCase();
  const bodyText = $("body").text().toLowerCase();

  return (
    title.includes("just a moment") ||
    title.includes("attention required") ||
    bodyText.includes("enable javascript") ||
    bodyText.includes("enable cookies") ||
    html.includes("cdn-cgi/challenge-platform") ||
    html.includes("_cf_chl_opt")
  );
}

function detectPreorder($: cheerio.CheerioAPI, pageText: string): boolean {
  const preorderSelectors = [
    '*[data-testid*="preorder"]',
    '*[data-test*="preorder"]',
    '*[data-qa*="preorder"]',
    'button:contains("Preorder")',
    'button:contains("Pre-order")',
    'button:contains("Pre order")',
    'a:contains("Preorder")',
    'a:contains("Pre-order")',
    '.badge-preorder',
    '.pre-order',
    '.preorder'
  ];

  const hasExplicitPreorderElement = preorderSelectors.some(selector =>
    $(selector)
      .filter((_, el) => $(el).text().toLowerCase().includes("pre-order") || $(el).text().toLowerCase().includes("preorder"))
      .length > 0
  );

  if (hasExplicitPreorderElement) {
    return true;
  }

  const availabilityHref =
    $("[itemprop='availability']").attr("href") ||
    $("meta[itemprop='availability']").attr("content") ||
    $("link[itemprop='availability']").attr("href");

  if (availabilityHref && availabilityHref.toLowerCase().includes("preorder")) {
    return true;
  }

  const ldAvailabilities = new Set<string>();
  $("script[type='application/ld+json']").each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      parseLdAvailability(data, ldAvailabilities);
    } catch {
      // Ignore malformed JSON blocks – EB Games sometimes includes templated variables
    }
  });

  const hasLdPreorder = Array.from(ldAvailabilities).some(value =>
    value.toLowerCase().includes("preorder")
  );

  if (hasLdPreorder) {
    return true;
  }

  const preorderTextIndicators = [
    "preorder",
    "pre-order",
    "pre order",
    "prepurchase",
    "pre-purchase",
    "collect on release",
    "release day",
    "coming soon",
    "release date"
  ];

  const hasKeyword = preorderTextIndicators.some(keyword => pageText.includes(keyword));
  const mentionsDeposit = pageText.includes("deposit");
  const mentionsReleaseYear = /20\d{2}/.test(pageText);

  return hasKeyword || mentionsDeposit || mentionsReleaseYear;
}

async function checkEBWithPlaywright(url: string): Promise<NormalizedProduct> {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-AU'
    });
    
    const page = await context.newPage();
    
    // Navigate to the page and wait for network to be idle
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait a bit for any dynamic content
    await page.waitForTimeout(2000);
    
    // Get the page content
    const html = await page.content();
    const $ = cheerio.load(html);
    
    // Extract title
    const title = await page.evaluate(() => {
      const selectors = [
        'h1.product-title',
        'h1[data-testid="product-title"]',
        '.product-name h1',
        'h1'
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          return el.textContent.trim();
        }
      }
      
      return document.title || 'Unknown Product';
    });
    
    // Extract price
    const price = await page.evaluate(() => {
      const priceSelectors = [
        '.price-current',
        '.current-price',
        '.product-price',
        '.price',
        '[data-testid="price"]',
        '[itemprop="price"]'
      ];
      
      for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const priceText = el.textContent || el.getAttribute('content') || el.getAttribute('value');
          if (priceText) {
            const match = priceText.match(/[\d.,]+/);
            if (match) {
              const parsed = parseFloat(match[0].replace(/,/g, ''));
              if (!isNaN(parsed) && parsed > 0) {
                return parsed;
              }
            }
          }
        }
      }
      
      return null;
    });
    
    // Check for preorder using Playwright
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const isPreorder = detectPreorder($, pageText) || await page.evaluate(() => {
      // Additional Playwright-specific checks
      const preorderElements = document.querySelectorAll('*');
      for (const el of preorderElements) {
        const text = el.textContent || '';
        if (text.toLowerCase().includes('preorder') || 
            text.toLowerCase().includes('pre-order') ||
            text.toLowerCase().includes('pre order')) {
          return true;
        }
      }
      return false;
    });
    
    let inStock = false;
    
    if (isPreorder) {
      inStock = true;
    } else {
      // Check for add to cart buttons
      const hasAddToCart = await page.evaluate(() => {
        const buttonSelectors = [
          'button:not(:disabled)',
          'input[type="button"]:not(:disabled)',
          'input[type="submit"]:not(:disabled)'
        ];
        
        for (const selector of buttonSelectors) {
          const buttons = document.querySelectorAll(selector);
          for (const button of buttons) {
            const text = (button.textContent || button.getAttribute('value') || '').toLowerCase();
            if (text.includes('add to cart') || 
                text.includes('add to basket') ||
                text.includes('wishlist')) {
              return true;
            }
          }
        }
        
        return false;
      });
      
      if (hasAddToCart) {
        inStock = true;
      } else {
        // Check for out of stock indicators
        const isOutOfStock = await page.evaluate(() => {
          const pageText = document.body.innerText.toLowerCase();
          return pageText.includes('out of stock') || 
                 pageText.includes('sold out') ||
                 pageText.includes('not available');
        });
        
        inStock = !isOutOfStock;
      }
    }
    
    await browser.close();
    
    return {
      retailer: "ebgames.com.au",
      productUrl: url,
      productTitle: title,
      variants: [
        {
          price,
          inStock,
          isPreorder
        }
      ]
    };
    
  } catch (error) {
    await browser.close();
    console.error(`Error scraping EB Games with Playwright ${url}:`, error);
    throw error;
  }
}

export async function checkEB(url: string): Promise<NormalizedProduct> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
        "Referer": "https://www.ebgames.com.au/"
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    if (detectCloudflareInterception(html, $)) {
      console.log("Cloudflare challenge detected, using Playwright...");
      return await checkEBWithPlaywright(url);
    }

    const title =
      $("h1.product-title").text().trim() ||
      $("h1[data-testid='product-title']").text().trim() ||
      $(".product-name h1").text().trim() ||
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      "Unknown Product";

    const priceSelectors = [
      ".price-current",
      ".current-price",
      ".product-price",
      ".price",
      "[data-testid='price']",
      "[itemprop='price']"
    ];

    let price: number | null = null;
    for (const selector of priceSelectors) {
      const el = $(selector).first();
      if (!el.length) continue;

      const priceFromAttr = el.attr("content") || el.attr("value");
      price = sanitizePrice(priceFromAttr || el.text().trim());
      if (price !== null) break;
    }

    const pageText = $("body").text().toLowerCase();

    let inStock = false;
    let isPreorder = detectPreorder($, pageText);

    if (isPreorder) {
      inStock = true;
    } else {
      const availabilitySelectors = [
        "button:contains('Add to Cart')",
        "button:contains('Add to Basket')",
        "button:contains('Add to cart')",
        "button:contains('Add to basket')",
        "button:contains('SAVE TO WISHLIST')",
        ".add-to-cart",
        "[data-testid='add-to-cart']",
        "input[value*='Add to Cart']"
      ];

      const hasAvailabilityButton = availabilitySelectors.some(selector =>
        $(selector).filter((_, el) => !$(el).is(":disabled") && !$(el).hasClass("disabled")).length > 0
      );

      if (hasAvailabilityButton) {
        inStock = true;
      } else {
        const outOfStockSelectors = [
          "*:contains('Out of Stock')",
          "*:contains('Sold Out')",
          "*:contains('Not Available')",
          ".out-of-stock",
          ".sold-out"
        ];

        const hasOutOfStockElement = outOfStockSelectors.some(selector => $(selector).length > 0);
        inStock = hasOutOfStockElement ? false : inStock;
      }
    }

    return {
      retailer: "ebgames.com.au",
      productUrl: url,
      productTitle: title,
      variants: [
        {
          price,
          inStock,
          isPreorder
        }
      ]
    };
  } catch (error) {
    console.error(`Error scraping EB Games product ${url}:`, error);
    
    // Try Playwright as fallback for any error
    try {
      console.log("Attempting to scrape with Playwright as fallback...");
      return await checkEBWithPlaywright(url);
    } catch (playwrightError) {
      console.error(`Playwright scraping also failed for ${url}:`, playwrightError);
      
      return {
        retailer: "ebgames.com.au",
        productUrl: url,
        productTitle: "Error loading product",
        variants: [
          {
            price: null,
            inStock: false,
            isPreorder: false
          }
        ]
      };
    }
  }
}
