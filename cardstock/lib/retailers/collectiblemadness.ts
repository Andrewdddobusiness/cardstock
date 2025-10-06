import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { NormalizedProduct } from './index';

type CMStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'PREORDER' | 'UNKNOWN';

interface CMSignals {
  // SSR/hydrated DOM text
  hasStockInStock?: boolean;      // "Stock: In stock"
  hasStockEnquire?: boolean;      // "Stock: Enquire Below"
  hasNotify?: boolean;            // "Notify me when available" control
  explicitPreorder?: boolean;     // 'preorder' in title/badges/description
  addToCartEnabled?: boolean;     // enabled button inside product form
  jsonldAvailability?: 'InStock'|'OutOfStock'|'PreOrder'|'Unknown'; // optional
}

function decideCM(s: CMSignals): CMStatus {
  // JSON-LD can short-circuit when present
  if (s.jsonldAvailability === 'PreOrder')       return 'PREORDER';
  if (s.jsonldAvailability === 'InStock')        return 'IN_STOCK';
  if (s.jsonldAvailability === 'OutOfStock')     return 'OUT_OF_STOCK';

  // Site-specific order:
  if (s.explicitPreorder)                        return 'PREORDER';
  if (s.hasStockInStock || s.addToCartEnabled)   return 'IN_STOCK';
  if (s.hasStockEnquire || s.hasNotify)          return 'OUT_OF_STOCK';

  return 'UNKNOWN';
}

async function checkCollectibleMadnessWithPlaywright(url: string): Promise<CMSignals & { html: string; title?: string; price?: number }> {
  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--disable-blink-features=AutomationControlled'] 
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-AU',
      timezoneId: 'Australia/Sydney'
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});

    const pdp = page.locator('main, #MainContent, .product, .productView, .product-single, .product-page').first();
    await pdp.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});

    // Readiness gate: poll until a decisive element appears
    const deadline = Date.now() + 8000;
    let addVisible = false, addEnabled = false;
    while (Date.now() < deadline) {
      // Add-to-cart
      const btn = pdp.getByRole('button', { name: /add to cart|buy now|add to bag/i }).first();
      addVisible = await btn.isVisible().catch(() => false);
      addEnabled = addVisible ? await btn.isEnabled().catch(() => false) : false;

      // Stock line / Notify / Enquire / Preorder text
      const inner = (await pdp.innerText().catch(() => '')).toLowerCase();
      const hasStockLine   = /\bstock:\s*(in stock|enquire)\b/.test(inner);
      const hasNotifyCtl   = /notify me when available/.test(inner);
      const hasEnquireCtl  = /\benquire\b/.test(inner);
      const hasPreorderTxt = /\bpre[-\s]?order\b/.test(inner);

      if (addVisible || hasStockLine || hasNotifyCtl || hasEnquireCtl || hasPreorderTxt) break;
      await page.waitForTimeout(250 + Math.floor(Math.random() * 200));
    }

    const html = await page.content();
    await context.close();
    
    // Reuse the SSR parser over the hydrated HTML
    const $ = cheerio.load(html);
    const $pdp = $('main, #MainContent, .product, .productView, .product-single, .product-page').first().length
      ? $('main, #MainContent, .product, .productView, .product-single, .product-page').first()
      : $('body');

    // Extract title and price
    const title = $pdp.find('h1, .productView-title, .product__title').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim() ||
      'Unknown Product';

    let price: number | null = null;
    const priceText = $pdp.find('.sale-price, .price, [class*="price"]').first().text().trim() ||
      $pdp.find('[itemprop="price"]').attr('content') || '';
    const m = priceText.match(/[\d,]+(?:\.\d+)?/);
    if (m) price = parseFloat(m[0].replace(/,/g, ''));

    // Stock line - prefer inventory node first
    const $stockNode =
      $pdp.find('.product-form__inventory').first().length
        ? $pdp.find('.product-form__inventory').first()
        : $pdp.find('.productView-availability, .product__stock, .product-form__inventory, [class*="stock"], .product__info-stock').first();

    const stockLine = ($stockNode.text() || '').toLowerCase().replace(/\s+/g,' ').trim();
    
    // Check for inventory badge classes (strong positive)
    const hasInventoryBadge =
      $pdp.find('.product-form__inventory.inventory--high, .product-form__inventory.inventory--medium, .product-form__inventory.inventory--low').length > 0;
    
    const hasStockInStock = hasInventoryBadge || /\bin stock\b/.test(stockLine);
    const hasStockEnquire = /\benquire\b/.test(stockLine);

    const header = ($pdp.find('.badge, .label, .productView-badges, h1, .product__title').text() || '').toLowerCase();
    const desc   = ($pdp.find('.product__description, .productView-description, #product-description, .rte, .tabs-content').text() || '').toLowerCase();
    const explicitPreorder = /\bpre[-\s]?order\b/.test(header) || /\bpre[-\s]?order\b/.test(desc);

    // JSON-LD
    let jsonldAvailability: CMSignals['jsonldAvailability'] = 'Unknown';
    let hasLdInStock = false;
    let hasLdPreorder = false;
    let hasLdOutOfStock = false;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).contents().text());
        const items = Array.isArray(data) ? data : [data];
        for (const d of items) {
          const offers = d?.offers ?? d?.offer;
          const arr = Array.isArray(offers) ? offers : offers ? [offers] : [];
          for (const off of arr) {
            const a = String(off?.availability || '').toLowerCase();
            if (a.includes('instock')) hasLdInStock = true;
            if (a.includes('preorder')) hasLdPreorder = true;
            if (a.includes('outofstock')) hasLdOutOfStock = true;
          }
        }
      } catch {}
    });
    if (hasLdInStock) jsonldAvailability = 'InStock';
    else if (hasLdPreorder) jsonldAvailability = 'PreOrder';
    else if (hasLdOutOfStock) jsonldAvailability = 'OutOfStock';

    // Scoped to product form area only
    const hasNotify = $pdp
      .find('.product-form, .productView-actions, .product-form__buttons, .product__info, form[action*="/cart/add"]')
      .find('button, a')
      .filter((_, el) => /notify me when available/i.test($(el).text()))
      .length > 0;

    return {
      hasStockInStock,
      hasStockEnquire,
      hasNotify,
      explicitPreorder,
      addToCartEnabled: addVisible && addEnabled,
      jsonldAvailability,
      html,
      title,
      price: price !== null ? price : undefined  // Convert null to undefined for type compatibility
    };
  } finally {
    await browser.close();
  }
}

export async function checkCollectibleMadness(url: string): Promise<NormalizedProduct> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    // --- PDP scope ---
    const $pdp =
      $('main, #MainContent, .product, .productView, .product-single, .product-page').first().length
        ? $('main, #MainContent, .product, .productView, .product-single, .product-page').first()
        : $('body');

    // Helper function
    const text = ($el: cheerio.Cheerio<any>): string => {
      return ($el.text() || '').toLowerCase().replace(/\s+/g, ' ').trim();
    };

    // --- Title ---
    let title =
      $pdp.find('h1, .productView-title, .product__title').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim() ||
      'Unknown Product';

    // --- Price ---
    let price: number | null = null;
    const priceText =
      $pdp.find('.sale-price, .price, [class*="price"]').first().text().trim() ||
      $pdp.find('[itemprop="price"]').attr('content') ||
      '';
    const m = priceText.match(/[\d,]+(?:\.\d+)?/);
    if (m) price = parseFloat(m[0].replace(/,/g, ''));

    // 1) Stock line - prefer inventory node first
    const $stockNode =
      $pdp.find('.product-form__inventory').first().length
        ? $pdp.find('.product-form__inventory').first()
        : $pdp.find('.productView-availability, .product__stock, .product-form__inventory, [class*="stock"], .product__info-stock').first();

    const stockLine = text($stockNode);
    
    // Check for inventory badge classes (strong positive)
    const hasInventoryBadge =
      $pdp.find('.product-form__inventory.inventory--high, .product-form__inventory.inventory--medium, .product-form__inventory.inventory--low').length > 0;
    
    const hasStockInStock = hasInventoryBadge || /\bin stock\b/.test(stockLine);
    const hasStockEnquire = /\benquire\b/.test(stockLine);

    // 2) Preorder (title/badges/description)
    const header = text($pdp.find('.badge, .label, .productView-badges, h1, .product__title'));
    const desc = text($pdp.find('.product__description, .productView-description, #product-description, .rte, .tabs-content'));
    const explicitPreorder = /\bpre[-\s]?order\b/.test(header) || /\bpre[-\s]?order\b/.test(desc);

    // 3) CTA enabled (inside product form)
    const addToCartEnabled =
      $pdp.find('form[action*="/cart/add"] button[type="submit"], button[name="add"]').filter((_, el) => {
        const $el = $(el);
        const t = ($el.text() || $el.attr('value') || '').toLowerCase();
        const disabled = $el.is('[disabled]') || $el.attr('aria-disabled') === 'true';
        return /add to cart|buy now|add to bag/.test(t) && !disabled;
      }).length > 0;

    // 4) OOS affordances - scoped to product form area only
    const $productFormArea = $pdp.find('.product-form, .productView-actions, .product-form__buttons, .product__info, form[action*="/cart/add"]');
    
    // First check if we have a product form area
    const hasProductFormArea = $productFormArea.length > 0;
    
    // Only look for notify within the product form area
    let hasNotify = false;
    if (hasProductFormArea) {
      hasNotify = $productFormArea
        .find('button, a')
        .filter((_, el) => {
          const $el = $(el);
          // Exclude elements that are likely part of a global widget
          const isInModal = $el.closest('.modal, .popup, .overlay, [class*="widget"]').length > 0;
          const isFixed = $el.css('position') === 'fixed' || $el.closest('[style*="position: fixed"]').length > 0;
          
          if (isInModal || isFixed) return false;
          
          return /notify me when available/i.test($el.text());
        })
        .length > 0;
    }
    
    // Additional check: if there's no product form area found, don't trust hasNotify
    if (!hasProductFormArea && $('button, a').filter((_, el) => /notify me when available/i.test($(el).text())).length > 0) {
      console.log(`Warning: Found notify button but no product form area to scope it to - ignoring`);
    }

    // 5) JSON-LD (optional)
    let jsonldAvailability: CMSignals['jsonldAvailability'] = 'Unknown';
    let hasLdInStock = false;
    let hasLdPreorder = false;
    let hasLdOutOfStock = false;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).contents().text());
        const items = Array.isArray(data) ? data : [data];
        for (const d of items) {
          const offers = d?.offers ?? d?.offer;
          const arr = Array.isArray(offers) ? offers : offers ? [offers] : [];
          for (const off of arr) {
            const a = String(off?.availability || '').toLowerCase();
            if (a.includes('instock')) hasLdInStock = true;
            if (a.includes('preorder')) hasLdPreorder = true;
            if (a.includes('outofstock')) hasLdOutOfStock = true;
          }
        }
      } catch {}
    });
    if (hasLdInStock) jsonldAvailability = 'InStock';
    else if (hasLdPreorder) jsonldAvailability = 'PreOrder';
    else if (hasLdOutOfStock) jsonldAvailability = 'OutOfStock';

    const signals: CMSignals = {
      hasStockInStock,
      hasStockEnquire,
      hasNotify,
      explicitPreorder,
      addToCartEnabled,
      jsonldAvailability
    };

    // Debug logging
    console.log(`Collectible Madness SSR signals for ${url}:`, {
      hasStockInStock,
      hasStockEnquire,
      hasNotify,
      explicitPreorder,
      addToCartEnabled,
      jsonldAvailability,
      stockLine,
      hasInventoryBadge
    });

    let status = decideCM(signals);

    // Check for weak OOS - OOS derived only from notify/enquire signals
    const weakOOSOnly =
      status === 'OUT_OF_STOCK' &&
      !signals.hasStockInStock &&
      !signals.addToCartEnabled &&
      !signals.explicitPreorder &&
      (signals.hasStockEnquire || signals.hasNotify);

    // Escalate to Playwright when needed
    const needsHydration =
      status === 'UNKNOWN' ||
      weakOOSOnly || // Escalate on weak OOS signals
      (!signals.hasStockInStock && !signals.hasStockEnquire && !signals.addToCartEnabled && !signals.explicitPreorder);

    if (needsHydration) {
      console.log(`Collectible Madness: SSR status ${status}, escalating to Playwright for ${url}`);
      const hydrated = await checkCollectibleMadnessWithPlaywright(url);
      status = decideCM(hydrated);
      
      // Use hydrated title/price if available
      if (hydrated.title) title = hydrated.title;
      if (hydrated.price !== undefined) price = hydrated.price;
      
      console.log(`Collectible Madness: Playwright status ${status} for ${url}`);
    }

    const isInStock = status === 'IN_STOCK';
    const isPreorder = status === 'PREORDER';
    const isUnavailable = false;

    return {
      retailer: 'Collectible Madness',
      productUrl: url,
      productTitle: title,
      variants: [{ price, inStock: isInStock, isPreorder, isUnavailable }],
    };
  } catch (err) {
    console.error(`Collectible Madness scrape failed for ${url}:`, err);
    return {
      retailer: 'Collectible Madness',
      productUrl: url,
      productTitle: 'Error loading product',
      variants: [{ price: null, inStock: false, isPreorder: false, isUnavailable: false }],
    };
  }
}
