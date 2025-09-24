import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adapters } from "@/lib/retailers";
import { applyResult } from "@/lib/normalizer";
import { withThrottle } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await (prisma.product as any).findMany({ 
      include: { 
        retailer: true, 
        variants: true 
      }
    });
    
    let processed = 0;
    let errors = 0;

    for (const product of products) {
      try {
        await withThrottle(`product:${product.id}`, 60, async () => {
          console.log(`Checking stock for: ${product.title} (${product.retailer.name})`);
          
          const adapter = adapters[product.retailer.platform] ?? adapters.genericDom;
          const result = await adapter(product.url, { postcode: "2000" });
          
          const resultVariant = result.variants[0];
          const statusText = resultVariant?.isPreorder ? 'Preorder' : 
                           resultVariant?.isInStoreOnly ? 'In Store Only' :
                           (resultVariant?.inStock ? 'In Stock' : 'Out of Stock');
          console.log(`Scrape result: ${result.productTitle} - $${resultVariant?.price} - ${statusText}`);
          
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
          processed++;
        });
      } catch (error) {
        console.error(`Error processing product ${product.id} (${product.title}):`, error instanceof Error ? error.message : String(error));
        errors++;
      }
    }

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