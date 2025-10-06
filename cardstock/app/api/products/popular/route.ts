import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Map slugs to search terms
const productMappings: Record<string, string[]> = {
  'evolving-skies-booster-box': ['evolving skies booster box', 'evolving skies booster', 'evolving skies'],
  'mega-evolutions-phantasmal-flame': ['mega evolutions phantasmal flame', 'phantasmal flame', 'mega evolution'],
  'shining-fates-elite-trainer-box': ['shining fates elite trainer box', 'shining fates etb', 'shining fates'],
  'hidden-fates-elite-trainer-box': ['hidden fates elite trainer box', 'hidden fates etb', 'hidden fates']
};

export async function GET(request: NextRequest) {
  try {
    const summaries: Record<string, any> = {};
    
    // For each popular product, fetch the matching products and calculate summary
    for (const [slug, searchTerms] of Object.entries(productMappings)) {
      const products = await prisma.product.findMany({
        where: {
          OR: searchTerms.map(term => ({
            title: {
              contains: term,
              mode: 'insensitive' as const
            }
          }))
        },
        include: {
          retailer: true,
          variants: {
            include: {
              snapshots: {
                orderBy: { seenAt: 'desc' },
                take: 1
              },
              events: {
                orderBy: { occurredAt: 'desc' },
                take: 1
              }
            }
          }
        }
      });

      let inStock = 0;
      let outOfStock = 0;
      let preorder = 0;

      products.forEach(product => {
        const variant = product.variants[0];
        if (!variant) return;

        const latestSnapshot = variant.snapshots[0];
        const latestEvent = variant.events[0];
        
        if (latestEvent?.details && typeof latestEvent.details === 'object' && 'cur' in latestEvent.details) {
          const curDetails = (latestEvent.details as any).cur;
          if (curDetails?.isPreorder) {
            preorder++;
          } else if (latestSnapshot?.inStock) {
            inStock++;
          } else {
            outOfStock++;
          }
        } else if (latestSnapshot?.inStock) {
          inStock++;
        } else {
          outOfStock++;
        }
      });

      summaries[slug] = {
        inStock,
        outOfStock,
        preorder,
        total: inStock + outOfStock + preorder
      };
    }

    return NextResponse.json(summaries);
  } catch (error) {
    console.error("Error fetching popular product summaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch summaries" },
      { status: 500 }
    );
  }
}