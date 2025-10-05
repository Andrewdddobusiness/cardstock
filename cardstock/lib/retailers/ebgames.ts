import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { NormalizedProduct } from "./index";

class CloudflareChallengeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareChallengeError";
  }
}

// Production-ready status model per specification
type EBStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'PREORDER' | 'REMOVED' | 'UNKNOWN';

interface EBVerdict {
  status: EBStatus;               // single source of truth
  inStock: boolean;              // derived (IN_STOCK only)
  isPreorder: boolean;           // PREORDER only
  reason: 'API_IN_STOCK' | 'JSONLD_IN_STOCK' | 'EXPLICIT_OOS' | 
          'JSONLD_OUT_OF_STOCK' | 'JSONLD_PREORDER' | 
          'ADD_TO_CART_AVAILABLE' | 'PAGE_NOT_FOUND' | 'UNKNOWN';
}

interface EBSignals {
  apiInStock?: boolean;
  jsonldAvailability?: 'InStock'|'OutOfStock'|'PreOrder'|'Unknown';
  explicitOOSStrong?: boolean;
  explicitOOSWeak?: boolean;
  explicitPreorder?: boolean;
  pageRemoved: boolean;
  hydratedAddToCart?: boolean;
}

// Exact decision function — tuned for EB PDPs
function decideEB(signals: EBSignals): EBVerdict {
  // Page removed first
  if (signals.pageRemoved)
    return { status:'REMOVED', inStock:false, isPreorder:false, reason:'PAGE_NOT_FOUND' };

  // Authoritative API/inlined inventory (when present)
  if (signals.apiInStock)
    return { status:'IN_STOCK', inStock:true, isPreorder:false, reason:'API_IN_STOCK' };

  // 🟢 Preorder signals MUST be checked BEFORE strong OOS
  // This ensures products with both preorder and "sold out" text are correctly classified
  if (signals.jsonldAvailability === 'PreOrder')
    return { status:'PREORDER', inStock:false, isPreorder:true, reason:'JSONLD_PREORDER' };

  // Explicit preorder detection (release dates, deposit hints, etc)
  if (signals.explicitPreorder)
    return { status:'PREORDER', inStock:false, isPreorder:true, reason:'JSONLD_PREORDER' };

  // 🔴 Strong OOS comes AFTER preorder checks
  if (signals.explicitOOSStrong)
    return { status:'OUT_OF_STOCK', inStock:false, isPreorder:false, reason:'EXPLICIT_OOS' };

  // JSON-LD availability signals
  if (signals.jsonldAvailability === 'InStock')
    return { status:'IN_STOCK', inStock:true, isPreorder:false, reason:'JSONLD_IN_STOCK' };
  if (signals.jsonldAvailability === 'OutOfStock')
    return { status:'OUT_OF_STOCK', inStock:false, isPreorder:false, reason:'JSONLD_OUT_OF_STOCK' };

  // Weak OOS after all other checks
  if (signals.explicitOOSWeak)
    return { status:'OUT_OF_STOCK', inStock:false, isPreorder:false, reason:'EXPLICIT_OOS' };

  // Hydrated, enabled Add-to-Cart (client) last
  if (signals.hydratedAddToCart === true)
    return { status:'IN_STOCK', inStock:true, isPreorder:false, reason:'ADD_TO_CART_AVAILABLE' };

  return { status:'UNKNOWN', inStock:false, isPreorder:false, reason:'UNKNOWN' };
}

// Robust soft-404 detection per specification
function detectPageRemoved(html: string, $: cheerio.CheerioAPI, status: number): boolean {
  // HTTP status check
  if (status === 404 || status === 410) return true;
  
  // Soft-404 content check (scoped to main content only, no body fallback)
  const mainContent = $('main, .content, .product-container').first().text().toLowerCase();
  const softErrorPhrases = [
    'our princess is in another castle',
    'we couldn\'t find the page',
    'page not found',
    'page may have been moved or deleted'
  ];
  
  return softErrorPhrases.some(phrase => mainContent.includes(phrase));
}

// Server-first inlined state parser (reusing BigW's proven patterns)
function findEBInventorySignals($: cheerio.CheerioAPI): { 
  inStock?: boolean; 
  availableOnline?: boolean;
  purchasable?: boolean;
  signals: Record<string, any>;
} {
  const signals: Record<string, any> = {};
  
  // Inventory-related boolean keys to search for
  const inventoryKeys = ['inStock', 'availableOnline', 'purchasable', 'availability', 'availableToSell'];
  
  let foundInStock: boolean | undefined;
  let foundAvailableOnline: boolean | undefined;
  let foundPurchasable: boolean | undefined;
  
  // Helper to check if object has product context (SKU, price, offers, etc)
  function hasProductContext(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    const contextKeys = ['sku', 'id', 'price', 'title', 'name', 'offers', 'amount', 'priceRange', 'product'];
    return contextKeys.some(key => key in obj);
  }
  
  // Deep walk function to find inventory booleans near product context
  function walkForInventory(node: any, path: string[] = []): void {
    if (!node || typeof node !== 'object') return;
    
    // If this node has product context, check for inventory booleans
    if (hasProductContext(node)) {
      inventoryKeys.forEach(key => {
        if (typeof node[key] === 'boolean') {
          if (key === 'inStock' && foundInStock === undefined) {
            foundInStock = node[key];
            signals[`inventory_${key}`] = node[key];
          } else if (key === 'availableOnline' && foundAvailableOnline === undefined) {
            foundAvailableOnline = node[key];
            signals[`inventory_${key}`] = node[key];
          } else if (key === 'purchasable' && foundPurchasable === undefined) {
            foundPurchasable = node[key];
            signals[`inventory_${key}`] = node[key];
          }
        }
        
        // Also check for numeric availability
        if (key === 'availableToSell' && typeof node[key] === 'number') {
          const available = node[key] > 0;
          if (foundInStock === undefined) {
            foundInStock = available;
            signals[`inventory_${key}`] = node[key];
          }
        }
      });
    }
    
    // Recursively walk all properties
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'object' && value !== null) {
        walkForInventory(value, [...path, key]);
      }
    }
  }
  
  // Scan all script tags for JSON data (using BigW's proven patterns)
  const scriptTags = $('script');
  scriptTags.each((_, el) => {
    const content = $(el).html();
    if (!content) return;
    
    // Try to parse as JSON
    const jsonCandidates = [];
    
    // Direct JSON content
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      jsonCandidates.push(content.trim());
    }
    
    // Extract from __NEXT_DATA__ or application/json scripts
    if ($(el).attr('id') === '__NEXT_DATA__' || $(el).attr('type') === 'application/json') {
      jsonCandidates.push(content.trim());
    }
    
    // Look for variable assignments (using [\s\S]*? for multiline support)
    const varMatches = content.match(/(?:window\.|var\s+|const\s+|let\s+)[\w$]+\s*=\s*(\{[\s\S]*?\});?/g);
    if (varMatches) {
      varMatches.forEach(match => {
        const jsonMatch = match.match(/=\s*(\{[\s\S]*?\});?$/);
        if (jsonMatch) {
          jsonCandidates.push(jsonMatch[1]);
        }
      });
    }
    
    // Parse all JSON candidates
    jsonCandidates.forEach(jsonStr => {
      try {
        const data = JSON.parse(jsonStr);
        walkForInventory(data);
      } catch {
        // Ignore invalid JSON
      }
    });
  });
  
  return {
    inStock: foundInStock,
    availableOnline: foundAvailableOnline,
    purchasable: foundPurchasable,
    signals
  };
}

function sanitizePrice(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = value.match(/[\d.,]+/);
  if (!match) return null;
  const parsed = parseFloat(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// JSON-LD availability parser (Product-only, safer)
function parseEBJsonLdAvailability($: cheerio.CheerioAPI): 'InStock' | 'OutOfStock' | 'PreOrder' | 'Unknown' {
  const nodes = $('script[type="application/ld+json"]');
  for (const el of nodes.toArray()) {
    try {
      const data = JSON.parse($(el).contents().text());
      const items = Array.isArray(data) ? data : [data];
      for (const d of items) {
        // Only trust @type: Product nodes
        if (d?.['@type'] !== 'Product') continue;
        
        const offers = (d?.offers ?? d?.offer ?? d?.Offers);
        const arr = Array.isArray(offers) ? offers : offers ? [offers] : [];
        for (const off of arr) {
          const availRaw = String(off?.availability || '').toLowerCase();
          
          if (availRaw.includes('instock')) return 'InStock';
          if (availRaw.includes('outofstock')) return 'OutOfStock';
          if (availRaw.includes('preorder')) return 'PreOrder';
        }
      }
    } catch { /* ignore malformed JSON */ }
  }
  return 'Unknown';
}

// Explicit pre-order detection (semantic, multi-signal)
function detectExplicitPreorder($: cheerio.CheerioAPI): boolean {
  // Try multiple container selectors that work for EB Games
  let $pdp = $('main, #main, .content, .product-container').first();

  // If traditional containers not found, try EB Games specific selectors
  if (!$pdp.length) {
    // Try to find the product detail area by looking for elements with product classes
    $pdp = $('[class*="product-detail"], [class*="pdp"], [class*="Product"]').first();

    // If still not found, use a broader approach but exclude footer/header
    if (!$pdp.length) {
      // Get the body content excluding header and footer
      const $body = $('body');

      // Clone the body and remove header/footer to avoid false positives
      const $content = $body.clone();
      $content.find('header, [class*="header"], [class*="Header"], nav, footer, [class*="footer"], [class*="Footer"]').remove();
      $pdp = $content;
    }
  }

  // If still no container found, return false
  if (!$pdp.length) return false;

  const t = $pdp.text().toLowerCase();

  // Direct badge/cta wording - more flexible patterns
  if (/preorder|pre-order|pre\s+order/.test(t)) return true;

  // Release date near buy area (months/weekday pattern covers EB chips like "Fri, 14 Nov 2025")
  const hasRelease = /\b(release|releases|releasing|release date)\b/.test(t) ||
                     /\b(?:mon|tue|wed|thu|fri|sat|sun),?\s+\d{1,2}\s+\w+\s+\d{4}\b/i.test(t);

  // Deposit hint used by EB for preorder
  const hasDeposit = /\bdeposit\b/.test(t);

  return hasRelease || hasDeposit;
}

// Split OOS into strong vs weak (scoped to main content)
function detectExplicitOOSFlags($: cheerio.CheerioAPI): { strong: boolean; weak: boolean } {
  // Use the same container logic as detectExplicitPreorder
  let $pdp = $('main, #main, .content, .product-container').first();

  // If traditional containers not found, try EB Games specific selectors
  if (!$pdp.length) {
    $pdp = $('[class*="product-detail"], [class*="pdp"], [class*="Product"]').first();

    // If still not found, use body excluding header/footer
    if (!$pdp.length) {
      const $body = $('body');
      const $content = $body.clone();
      $content.find('header, [class*="header"], [class*="Header"], nav, footer, [class*="footer"], [class*="Footer"]').remove();
      $pdp = $content;
    }
  }

  const t = ($pdp.text() || '').toLowerCase();

  const strong = /(sold out|out of stock|no longer available)/.test(t);
  const weak   = /(unavailable online|currently unavailable|not available online|not available)/.test(t);

  return { strong, weak };
}

// Removed: parseLdAvailability - replaced with parseEBJsonLdAvailability

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

// Skeleton selectors seen commonly across frameworks; keep broad but safe
const SKELETON_SELS = [
  '.MuiSkeleton-root',
  '[class*="skeleton"]',
  '[data-testid*="skeleton"]',
  '[aria-busy="true"]',
];

// Status anchors that indicate hydrated content is present
const STATUS_ANCHORS = [
  // strong OOS text in PDP container
  /(?:^|\b)(out of stock|sold out|no longer available)(?:\b|$)/i,
  // preorder badge/cta
  /(?:^|\b)pre[\s-]?order(?:\b|$)/i,
];

async function waitForEbpdpReady(page: import('playwright').Page, timeoutMs = 8000) {
  const start = Date.now();
  const pdp = page.locator('main, #main, .content, .product-container').first();

  // Wait for the PDP container at least
  await pdp.waitFor({ state: 'visible', timeout: Math.min(2000, timeoutMs) }).catch(() => {});

  // Poll until one of these happens:
  //  - no visible skeletons in PDP area
  //  - a status anchor is visible (OOS or preorder text)
  //  - an Add to Cart button exists and is either enabled or clearly disabled
  while (Date.now() - start < timeoutMs) {
    const hasSkeleton =
      (await pdp.locator(SKELETON_SELS.join(',')).first().isVisible().catch(() => false)) === true;

    // Text anchor checks
    const text = (await pdp.innerText().catch(() => '')).toLowerCase();
    const hasStatusAnchor = STATUS_ANCHORS.some((re) => re.test(text));

    // CTA checks (scoped, and enabled-awareness)
    const btn = pdp.getByRole('button', { name: /add to cart/i }).first();
    const btnVisible = await btn.isVisible().catch(() => false);
    const btnEnabled = btnVisible ? await btn.isEnabled().catch(() => false) : false;

    if (!hasSkeleton && (hasStatusAnchor || btnVisible)) {
      return { btnVisible, btnEnabled };
    }

    // small backoff jitter
    await page.waitForTimeout(250 + Math.floor(Math.random() * 200));
  }

  // Fallback: return whatever we could read (likely unknown)
  const btn = page.locator('main, #main, .content, .product-container').first()
    .getByRole('button', { name: /add to cart/i }).first();
  const btnVisible = await btn.isVisible().catch(() => false);
  const btnEnabled = btnVisible ? await btn.isEnabled().catch(() => false) : false;
  return { btnVisible, btnEnabled };
}

async function checkEBWithPlaywright(url: string): Promise<NormalizedProduct> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-AU',
      timezoneId: 'Australia/Sydney',
    });

    const page = await context.newPage();

    // Capture product JSON the app fetches (authoritative signal)
    let apiInStock: boolean | undefined;
    page.on('response', async (r) => {
      try {
        const urlStr = r.url();
        const ct = r.headers()['content-type'] || '';
        if (!/json/i.test(ct)) return;
        if (!/product|pdp|graphql|inventory/i.test(urlStr)) return;
        const json = await r.json();
        const hit = findBooleanInJson(json);
        if (typeof hit === 'boolean') apiInStock = hit;
      } catch {}
    });

    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const pageStatus = res?.status() ?? 0;

    // Small jitter + network idle (bounded)
    await page.waitForTimeout(400 + Math.random() * 400);
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});

    // NEW: wait until skeletons are gone OR a status anchor/CTA is present
    let { btnVisible, btnEnabled } = await waitForEbpdpReady(page, 8000);

    // Helper to compute signals from current page state
    const computeSignals = async (): Promise<{ signals: EBSignals; $: cheerio.CheerioAPI }> => {
      const html = await page.content();
      const $ = cheerio.load(html);

      // Soft-404 detection scoped to main content
      const mainText = $('main, #main, .content, .product-container').first().text().toLowerCase();

      const soft404 = /our princess is in another castle|we couldn.?t find the page|page not found|may have been moved or deleted/.test(
        mainText
      );

      // JSON-LD availability
      const jsonldAvailability = parseEBJsonLdAvailability($);

      // Explicit pre-order and OOS text detection
      const explicitPreorder = detectExplicitPreorder($);
      const { strong: explicitOOSStrong, weak: explicitOOSWeak } = detectExplicitOOSFlags($);

      // Map CTA state
      const hydratedAddToCart = btnVisible && btnEnabled;

      return {
        signals: {
          pageRemoved: pageStatus === 404 || pageStatus === 410 || soft404,
          apiInStock,
          jsonldAvailability,
          explicitOOSStrong,
          explicitOOSWeak,
          explicitPreorder,
          hydratedAddToCart,
        },
        $,
      };
    };

    // Compute initial signals
    let { signals, $ } = await computeSignals();
    let verdict = decideEB(signals);


    // Retry loop: if verdict is still UNKNOWN, retry up to 3 times
    let retries = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 400;

    while (verdict.status === 'UNKNOWN' && retries < MAX_RETRIES) {
      await page.waitForTimeout(RETRY_DELAY);

      // Re-check button state
      const pdp = page.locator('main, #main, .content, .product-container').first();
      const btn = pdp.getByRole('button', { name: /add to cart/i }).first();
      btnVisible = await btn.isVisible().catch(() => false);
      btnEnabled = btnVisible ? await btn.isEnabled().catch(() => false) : false;

      // Recompute signals
      const retry = await computeSignals();
      signals = retry.signals;
      $ = retry.$;
      verdict = decideEB(signals);

      retries++;
    }

    // Title
    const title =
      $('h1.product-title').text().trim() ||
      $('[data-testid="product-title"]').text().trim() ||
      $('.product-name h1').text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim() ||
      'Unknown Product';

    // Price (don't flip status based on price)
    const price =
      sanitizePrice(
        $('.price-current, .current-price, .product-price, .price, [data-testid="price"], [itemprop="price"]')
          .first()
          .attr('content') ||
          $('.price-current, .current-price, .product-price, .price, [data-testid="price"], [itemprop="price"]')
            .first()
            .attr('value') ||
          $('.price-current, .current-price, .product-price, .price, [data-testid="price"], [itemprop="price"]')
            .first()
            .text()
      ) ?? null;

    await context.close();
    await browser.close();

    return {
      retailer: 'ebgames.com.au',
      productUrl: url,
      productTitle: title,
      variants: [
        {
          price,
          inStock: verdict.inStock,
          isPreorder: verdict.status === 'PREORDER',
          isUnavailable: verdict.status === 'REMOVED',
        },
      ],
    };
  } catch (error) {
    await browser.close().catch(() => {});
    console.error(`Error scraping EB Games with Playwright ${url}:`, error);
    throw error;
  }

  // Guarded deep scan for availability booleans
  function findBooleanInJson(obj: any): boolean | undefined {
    const keys = ['inStock', 'availableOnline', 'purchasable', 'availableToSell'];
    function hasProductCtx(o: any) {
      if (!o || typeof o !== 'object') return false;
      const ctx = ['sku', 'id', 'price', 'title', 'name', 'offers', 'product', 'gtin'];
      return ctx.some((k) => k in o);
    }
    let result: boolean | undefined;
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (hasProductCtx(node)) {
        for (const k of keys) {
          const v = (node as any)[k];
          if (typeof v === 'boolean' && result === undefined) result = v;
          if (k === 'availableToSell' && typeof v === 'number' && result === undefined) result = v > 0;
        }
      }
      for (const v of Object.values(node)) if (typeof v === 'object' && v) walk(v);
    };
    walk(obj);
    return result;
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

    // Handle 403 as likely Cloudflare blocking
    if (res.status === 403) {
      console.log("HTTP 403 detected (likely Cloudflare), using Playwright...");
      return await checkEBWithPlaywright(url);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    if (detectCloudflareInterception(html, $)) {
      console.log("Cloudflare challenge detected, using Playwright...");
      return await checkEBWithPlaywright(url);
    }

    // Enhanced logging context
    const phase = 'ssr';
    const debugInfo: Record<string, any> = { phase, url, signals: {} };

    // Extract title and price (unchanged)
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

    // NEW: Server-first detection hierarchy per specification
    
    // 1. Check for page removal (highest priority)
    const pageRemoved = detectPageRemoved(html, $, res.status);
    debugInfo.signals.pageRemoved = pageRemoved;
    
    // 2. Inlined state parsing (server-available signals)
    const inventorySignals = findEBInventorySignals($);
    debugInfo.signals.inventorySignals = inventorySignals.signals;
    
    // Determine API stock status (availableOnline is primary, then inStock, then purchasable)
    const apiInStock = inventorySignals.availableOnline ?? inventorySignals.inStock ?? inventorySignals.purchasable;
    debugInfo.signals.apiInStock = apiInStock;
    
    // 3. JSON-LD structured data
    const jsonldAvailability = parseEBJsonLdAvailability($);
    debugInfo.signals.jsonldAvailability = jsonldAvailability;
    
    // 4. Explicit pre-order and OOS text detection
    const explicitPreorder = detectExplicitPreorder($);
    const { strong: explicitOOSStrong, weak: explicitOOSWeak } = detectExplicitOOSFlags($);
    debugInfo.signals.explicitPreorder = explicitPreorder;
    debugInfo.signals.explicitOOSStrong = explicitOOSStrong;
    debugInfo.signals.explicitOOSWeak = explicitOOSWeak;
    
    // 5. Build signals object and make decision
    const signals: EBSignals = {
      apiInStock,
      jsonldAvailability,
      explicitOOSStrong,
      explicitOOSWeak,
      explicitPreorder,
      pageRemoved,
      // No hydrated signals in SSR mode
    };
    
    const verdict = decideEB(signals);
    debugInfo.verdict = verdict;
    
    console.log(`EB Games decision for ${url}:`, {
      reason: verdict.reason,
      status: verdict.status,
      inStock: verdict.inStock,
      isPreorder: verdict.isPreorder,
      title,
      price,
      debugSignals: Object.keys(debugInfo.signals)
    });

    return {
      retailer: "ebgames.com.au",
      productUrl: url,
      productTitle: title,
      variants: [
        {
          price,
          inStock: verdict.inStock,
          isPreorder: verdict.isPreorder,
          isUnavailable: verdict.status === 'REMOVED'
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
