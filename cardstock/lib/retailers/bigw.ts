// lib/retailers/bigw.ts
// Robust Big W stock detection with server-first signals and optional Playwright fallback.

import * as cheerio from 'cheerio';
import { NormalizedProduct } from './index';

export type BigWReason =
  | 'API_ONLINE_IN_STOCK'
  | 'JSONLD_IN_STOCK'
  | 'EXPLICIT_OOS'
  | 'ADD_TO_CART_AVAILABLE'  // from hydrated DOM ONLY
  | 'WISHLIST_ONLY'          // SSR: wishlist present without add-to-cart
  | 'UNKNOWN';

interface BigWResult {
  retailer: 'bigw.com.au';
  url: string;
  inStock: boolean;
  reason: BigWReason;
  title?: string;
  price?: number;
  currency?: string;
  productId?: string;
  isPreorder?: boolean;
  explain?: Record<string, any>; // persisted for auditing
  debugInfo?: Record<string, any>; // enhanced debugging information
}

const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'accept-language': 'en-AU,en;q=0.9',
};

// --- Core helpers ------------------------------------------------------------

async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  const response = await fetch(url, { 
    headers: DEFAULT_HEADERS
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  return cheerio.load(html);
}

function parseTitle($: cheerio.CheerioAPI): string | undefined {
  const og = $('meta[property="og:title"]').attr('content');
  const title = og || $('title').text();
  return title?.trim() || undefined;
}

function parseJsonLdAvailability($: cheerio.CheerioAPI): { 
  availability: 'InStock' | 'OutOfStock' | 'PreOrder' | 'Unknown'; 
  price?: number; 
  currency?: string 
} {
  const nodes = $('script[type="application/ld+json"]');
  for (const el of nodes.toArray()) {
    try {
      const data = JSON.parse($(el).contents().text());
      const items = Array.isArray(data) ? data : [data];
      for (const d of items) {
        const offers = (d?.offers ?? d?.offer ?? d?.Offers);
        const arr = Array.isArray(offers) ? offers : offers ? [offers] : [];
        for (const off of arr) {
          const availRaw = String(off?.availability || '').toLowerCase();
          const priceRaw = off?.price ?? off?.priceSpecification?.price;
          const currencyRaw = off?.priceCurrency ?? off?.priceSpecification?.priceCurrency;
          const price = typeof priceRaw === 'string' ? parseFloat(priceRaw.replace(/[^\d.]/g, '')) : typeof priceRaw === 'number' ? priceRaw : undefined;
          const currency = typeof currencyRaw === 'string' ? currencyRaw : undefined;

          if (availRaw.includes('instock')) return { availability: 'InStock', price, currency };
          if (availRaw.includes('outofstock')) return { availability: 'OutOfStock', price, currency };
          if (availRaw.includes('preorder')) return { availability: 'PreOrder', price, currency };
        }
      }
    } catch { /* ignore */ }
  }
  return { availability: 'Unknown' };
}

function scanSsrButtonsAndOOS($: cheerio.CheerioAPI) {
  const els = $('button, [role="button"], a');
  let hasAddToCart = false, hasWishlist = false, explicitOOS = false;

  const getLabel = (el: cheerio.Element) =>
    ($(el).attr('aria-label') || $(el).text() || '').trim().toLowerCase();

  els.each((_, el) => {
    const t = getLabel(el);
    if (t.includes('add to cart') || t.includes('add to bag') || t.includes('add to trolley')) hasAddToCart = true;
    if (t.includes('wishlist')) hasWishlist = true;
  });

  const body = $('body').text().toLowerCase();
  if (/(out of stock|sold out|unavailable)/i.test(body)) explicitOOS = true;

  return { hasAddToCart, hasWishlist, explicitOOS };
}

// Deep scan all JSON data for actual inventory booleans (not listing metadata)
function findInventorySignals($: cheerio.CheerioAPI): { 
  inStock?: boolean; 
  price?: number; 
  currency?: string; 
  isPreorder?: boolean;
  signals: Record<string, any>;
} {
  const signals: Record<string, any> = {};
  
  // Inventory-related boolean keys to search for
  const inventoryKeys = ['inStock', 'purchasable', 'availableOnline', 'availableToSell', 'isAvailable', 'available'];
  const preorderKeys = ['isPreOrder', 'preorder', 'preOrder'];
  
  let foundInStock: boolean | undefined;
  let foundIsPreorder: boolean | undefined;
  let foundPrice: number | undefined;
  let foundCurrency: string | undefined;
  
  // Helper to check if object has product context (SKU, price, offers, etc)
  function hasProductContext(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    const contextKeys = ['sku', 'id', 'price', 'title', 'name', 'offers', 'amount', 'priceRange'];
    return contextKeys.some(key => key in obj);
  }
  
  // Deep walk function to find inventory booleans near product context
  function walkForInventory(node: any, path: string[] = []): void {
    if (!node || typeof node !== 'object') return;
    
    // If this node has product context, check for inventory booleans
    if (hasProductContext(node)) {
      inventoryKeys.forEach(key => {
        if (typeof node[key] === 'boolean' && foundInStock === undefined) {
          foundInStock = node[key];
          signals[`inventory_${key}`] = node[key];
        }
      });
      
      preorderKeys.forEach(key => {
        if (typeof node[key] === 'boolean' && foundIsPreorder === undefined) {
          foundIsPreorder = node[key];
          signals[`preorder_${key}`] = node[key];
        }
      });
      
      // Extract price if available
      if (foundPrice === undefined) {
        if (typeof node.price === 'number' && node.price > 0) {
          foundPrice = node.price;
          foundCurrency = node.currency || 'AUD';
        } else if (node.amount && typeof node.amount === 'number') {
          foundPrice = node.amount / 100; // Convert cents to dollars
          foundCurrency = 'AUD';
        } else if (node.priceRange?.min?.amount) {
          foundPrice = node.priceRange.min.amount / 100;
          foundCurrency = 'AUD';
        }
      }
    }
    
    // Recursively walk all properties
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'object' && value !== null) {
        walkForInventory(value, [...path, key]);
      }
    }
  }
  
  // Scan all script tags for JSON data
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
    
    // Extract from Next.js __NEXT_DATA__
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
    price: foundPrice,
    currency: foundCurrency,
    isPreorder: foundIsPreorder,
    signals
  };
}

type Availability = 'InStock' | 'OutOfStock' | 'PreOrder' | 'Unknown';

function decideBigWStock(signals: {
  inventoryInStock?: boolean;
  inventoryIsPreorder?: boolean;
  jsonldAvailability: Availability;
  hasAddToCart: boolean; // SSR-only if Playwright disabled
  hasWishlist: boolean;
  explicitOOS: boolean;
  buttonSource: 'ssr' | 'hydrated'; // Track signal source
  debugSignals?: Record<string, any>;
}): { inStock: boolean; reason: BigWReason; isPreorder?: boolean; debugInfo?: Record<string, any> } {
  const { inventoryInStock, inventoryIsPreorder, jsonldAvailability, hasAddToCart, hasWishlist, explicitOOS, buttonSource, debugSignals } = signals;

  const debugInfo = {
    inventorySignals: debugSignals || {},
    decisionPath: [] as string[],
    buttonSource
  };

  // 1. Server inventory boolean is highest priority (actual inventory data)
  debugInfo.decisionPath.push('checking_inventory_boolean');
  if (inventoryInStock === true) {
    debugInfo.decisionPath.push('inventory_true');
    return { 
      inStock: true, 
      reason: 'API_ONLINE_IN_STOCK',
      isPreorder: inventoryIsPreorder,
      debugInfo
    };
  }
  if (inventoryInStock === false) {
    debugInfo.decisionPath.push('inventory_false');
    return { 
      inStock: false, 
      reason: 'EXPLICIT_OOS',
      debugInfo
    };
  }

  // 2. Explicit out of stock text overrides everything else
  debugInfo.decisionPath.push('checking_explicit_oos');
  if (explicitOOS) {
    debugInfo.decisionPath.push('explicit_oos_found');
    return { 
      inStock: false, 
      reason: 'EXPLICIT_OOS',
      debugInfo
    };
  }
  
  // 3. JSON-LD structured data (secondary signal)
  debugInfo.decisionPath.push('checking_jsonld');
  if (jsonldAvailability === 'InStock') {
    debugInfo.decisionPath.push('jsonld_instock');
    return { 
      inStock: true, 
      reason: 'JSONLD_IN_STOCK',
      debugInfo
    };
  }
  if (jsonldAvailability === 'PreOrder') {
    debugInfo.decisionPath.push('jsonld_preorder');
    return { 
      inStock: true, 
      reason: 'JSONLD_IN_STOCK', 
      isPreorder: true,
      debugInfo
    };
  }
  if (jsonldAvailability === 'OutOfStock') {
    debugInfo.decisionPath.push('jsonld_oos');
    return { 
      inStock: false, 
      reason: 'EXPLICIT_OOS',
      debugInfo
    };
  }
  
  // 4. Hydrated DOM signals (add to cart button - optional upgrade)
  debugInfo.decisionPath.push('checking_hydrated_buttons');
  if (hasAddToCart) {
    debugInfo.decisionPath.push('add_to_cart_found');
    return { 
      inStock: true, 
      reason: 'ADD_TO_CART_AVAILABLE',
      debugInfo
    };
  }
  
  // 5. Conservative: if we only see wishlist from HYDRATED DOM, assume out of stock
  // SSR-only wishlist is not definitive since Add to Cart is JS-rendered
  debugInfo.decisionPath.push('checking_wishlist_only');
  if (hasWishlist && !hasAddToCart) {
    if (buttonSource === 'hydrated') {
      debugInfo.decisionPath.push('wishlist_only_hydrated');
      return { 
        inStock: false, 
        reason: 'WISHLIST_ONLY',
        debugInfo
      };
    } else {
      debugInfo.decisionPath.push('wishlist_only_ssr_returning_unknown');
      // SSR wishlist without Add to Cart is not definitive - return UNKNOWN
    }
  }
  
  // 6. Unknown state - be conservative (distinguish from real OOS)
  debugInfo.decisionPath.push('unknown_fallback');
  return { 
    inStock: false, 
    reason: 'UNKNOWN',
    debugInfo
  };
}

// --- Optional Playwright (hydrated DOM) -------------------------------------

async function evaluateHydratedButtons(url: string): Promise<{ 
  hasAddToCart: boolean; 
  hasWishlist: boolean; 
  explicitOOS: boolean 
} | undefined> {
  if (!process.env.BIGW_USE_BROWSER) return undefined; // opt-in only

  // dynamic import to avoid bundling when not used
  let webkit: any, firefox: any, chromium: any;
  try {
    ({ webkit, firefox, chromium } = await import('playwright'));
  } catch {
    return undefined; // Playwright not installed in this runtime
  }

  const candidates = [
    { name: 'webkit',  launch: () => webkit.launch() },
    { name: 'firefox', launch: () => firefox.launch() },
    { name: 'chromium',launch: () => chromium.launch({ args: ['--disable-http2'] }) },
  ];

  for (const c of candidates) {
    let browser: any, ctx: any;
    try {
      browser = await c.launch();
      ctx = await browser.newContext({
        userAgent: DEFAULT_HEADERS['user-agent'],
        viewport: { width: 1280, height: 900 },
        locale: 'en-AU',
        timezoneId: 'Australia/Sydney',
      });
      const page = await ctx.newPage();

      await page.route('**/*', (route: any) => {
        const urlStr = route.request().url();
        if (/\.(png|jpg|jpeg|webp|gif|svg|woff2?)$/i.test(urlStr)) return route.abort();
        return route.continue();
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500 + Math.random() * 300);

      const state = await page.evaluate(() => {
        const getTxt = (el: Element) => (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();

        const els = Array.from(document.querySelectorAll('button, [role="button"], a'));
        let hasAddToCart = false, hasWishlist = false;

        for (const el of els) {
          const t = getTxt(el);
          if (t.includes('add to cart') || t.includes('add to bag') || t.includes('add to trolley')) hasAddToCart = true;
          if (t.includes('wishlist')) hasWishlist = true;
        }

        const body = (document.body?.innerText || '').toLowerCase();
        const explicitOOS = /out of stock|sold out|unavailable/.test(body);

        return { hasAddToCart, hasWishlist, explicitOOS };
      });

      await ctx.close(); 
      await browser.close();
      return state;
    } catch {
      try { 
        await ctx?.close(); 
        await browser?.close(); 
      } catch { /* ignore */ }
    }
  }
  return undefined;
}

function extractSkuFromUrl(url: string): string | undefined {
  // Extract product ID from BIG W URLs like: /product/pokemon-tcg/p/6047806
  const match = url.match(/\/p\/(\w+)$/);
  return match?.[1];
}

// --- Public entrypoint -------------------------------------------------------

async function scrapeBigW(url: string, opts?: { sku?: string }): Promise<BigWResult> {
  const explain: Record<string, any> = { url, phases: [] };

  // Extract SKU from URL if not provided
  const sku = opts?.sku || extractSkuFromUrl(url);

  // 1) SSR HTML (get HTML first so we can parse both JSON-LD and Next.js data)
  const $ = await fetchHtml(url);
  const title = parseTitle($);
  
  // 2) Deep scan for inventory signals (highest priority - actual inventory data)
  const inventoryResult = findInventorySignals($);
  explain.phases.push({ step: 'inventory_scan', ...inventoryResult });
  
  // 3) JSON-LD as secondary data source
  const jsonld = parseJsonLdAvailability($);
  
  // 4) SSR button scanning (fallback)
  const { hasAddToCart: ssrAddToCart, hasWishlist: ssrWishlist, explicitOOS: ssrOOS } = scanSsrButtonsAndOOS($);
  explain.phases.push({ step: 'ssr', title, jsonld, ssrAddToCart, ssrWishlist, ssrOOS });

  // 3) OPTIONAL hydrated DOM via Playwright (only to upgrade SSR signals)
  let hydrated = await evaluateHydratedButtons(url);
  if (hydrated) explain.phases.push({ step: 'hydrated', ...hydrated });

  // Use hydrated signals if present; otherwise SSR signals
  const hasAddToCart = hydrated?.hasAddToCart ?? ssrAddToCart;
  const hasWishlist  = hydrated?.hasWishlist  ?? ssrWishlist;
  const explicitOOS  = hydrated?.explicitOOS  ?? ssrOOS;
  const buttonSource: 'ssr' | 'hydrated' = hydrated ? 'hydrated' : 'ssr';

  // 5) Decide using corrected hierarchical signals
  const { inStock, reason, isPreorder, debugInfo } = decideBigWStock({
    inventoryInStock: inventoryResult.inStock,
    inventoryIsPreorder: inventoryResult.isPreorder,
    jsonldAvailability: jsonld.availability,
    hasAddToCart,
    hasWishlist,
    explicitOOS,
    buttonSource,
    debugSignals: inventoryResult.signals,
  });

  // Prefer inventory scan price, then JSON-LD price
  const price = inventoryResult.price ?? jsonld.price;
  const currency = inventoryResult.currency ?? jsonld.currency;

  return {
    retailer: 'bigw.com.au',
    url,
    inStock,
    reason,
    title,
    price,
    currency,
    productId: sku,
    isPreorder,
    explain,
    debugInfo,
  };
}

// Export function to match existing interface
export async function checkBigW(url: string): Promise<NormalizedProduct> {
  try {
    const result = await scrapeBigW(url);
    
    // Log decision for debugging with enhanced information
    console.log(`BIG W decision for ${url}:`, {
      reason: result.reason,
      inStock: result.inStock,
      title: result.title,
      price: result.price,
      debugPath: result.debugInfo?.decisionPath,
      inventorySignals: Object.keys(result.debugInfo?.inventorySignals || {})
    });
    
    return {
      retailer: result.retailer,
      productUrl: result.url,
      productTitle: result.title || "Unknown Product",
      sku: result.productId,
      variants: [{
        price: result.price || null,
        inStock: result.inStock,
        isPreorder: result.isPreorder || false
      }]
    };
    
  } catch (error) {
    console.error(`BIG W scraper failed for ${url}:`, error);
    
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