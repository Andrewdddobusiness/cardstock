import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adapters } from "@/lib/retailers";
import { applyResult } from "@/lib/normalizer";
import { withThrottle } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({ 
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
          const adapter = adapters[product.retailer.platform] ?? adapters.genericDom;
          const result = await adapter(product.url, { postcode: "2000" });
          
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
            price: null 
          };
          
          await applyResult(product.id, variant.id, firstVariant);
          processed++;
        });
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({ 
      ok: true, 
      processed,
      errors,
      total: products.length
    });
  } catch (error) {
    console.error("Monitor run error:", error);
    return NextResponse.json(
      { error: "Failed to run monitors" },
      { status: 500 }
    );
  }
}