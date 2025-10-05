import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adapters } from "@/lib/retailers";
import { applyResult } from "@/lib/normalizer";
import { withThrottle } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // TEMPORARILY excluding BigW items until scraping is fixed
    const products = await (prisma.product as any).findMany({ 
      where: {
        retailer: {
          name: {
            not: "BIG W"
          }
        }
      },
      include: { 
        retailer: true, 
        variants: true 
      }
    });
    
    let processed = 0;
    let errors = 0;

    console.log(`🚀 Starting monitor run for ${products.length} products`);
    console.log('='.repeat(60));

    for (const [index, product] of products.entries()) {
      try {
        console.log(`[${index + 1}/${products.length}] Processing: ${product.title}`);
        console.log(`  Retailer: ${product.retailer.name}`);
        console.log(`  URL: ${product.url}`);
        
        await withThrottle(`product:${product.id}`, 60, async () => {
          console.log(`  🔍 Scraping product data...`);
          
          const adapter = adapters[product.retailer.platform] ?? adapters.genericDom;
          const result = await adapter(product.url, { postcode: "2000" });
          
          const resultVariant = result.variants[0];
          const statusText = resultVariant?.isPreorder ? 'Preorder' : 
                           resultVariant?.isInStoreOnly ? 'In Store Only' :
                           (resultVariant?.inStock ? 'In Stock' : 'Out of Stock');
          console.log(`  📊 Scrape result: ${result.productTitle}`);
          console.log(`    Price: $${resultVariant?.price || 'N/A'}`);
          console.log(`    Status: ${statusText}`);
          
          // Get or create variant
          let variant = product.variants[0];
          if (!variant) {
            variant = await prisma.productVariant.create({ 
              data: { productId: product.id } 
            });
          }
          
          // Apply the first variant result
          const firstVariant = result.variants[0] || { 
            inStock: false, 
            price: null,
            isPreorder: false,
            isInStoreOnly: false
          };
          
          await applyResult(product.id, variant.id, firstVariant);
          console.log(`  ✅ Database updated successfully`);
          processed++;
        });
        console.log(`  ✅ Product ${index + 1}/${products.length} completed`);
        console.log('-'.repeat(40));
      } catch (error) {
        console.error(`  ❌ Error processing product ${product.id} (${product.title}):`, error instanceof Error ? error.message : String(error));
        console.log(`  ❌ Product ${index + 1}/${products.length} failed`);
        console.log('-'.repeat(40));
        errors++;
      }
    }

    console.log('='.repeat(60));
    console.log(`🏁 Monitor run completed`);
    console.log(`  Total products: ${products.length}`);
    console.log(`  Successfully processed: ${processed}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Success rate: ${products.length > 0 ? Math.round((processed / products.length) * 100) : 0}%`);

    return NextResponse.json({ 
      ok: true, 
      processed,
      errors,
      total: products.length,
      message: errors > 0 ? "Some products failed to process - check server logs" : "All products processed successfully"
    });
  } catch (error) {
    console.error("Monitor run error:", error);
    return NextResponse.json(
      { error: "Failed to run monitors" },
      { status: 500 }
    );
  }
}