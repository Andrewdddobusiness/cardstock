import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface StockStatusResponse {
  summary: {
    totalProducts: number;
    totalVariants: number;
    variantsWithData: number;
    recentUpdates: number;
    staleProducts: number;
  };
  recentActivity: Array<{
    productId: string;
    productTitle: string;
    retailerName: string;
    variantId: string;
    status: string;
    price: string | null;
    lastUpdate: string;
    eventType?: string;
    storeCount: number;
  }>;
  staleProducts: Array<{
    productId: string;
    productTitle: string;
    retailerName: string;
    variantId: string;
    lastUpdate: string | null;
    totalSnapshots: number;
  }>;
  dataIntegrity: {
    orphanSnapshots: number;
    orphanEvents: number;
    orphanAvailabilities: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get('hours') || '24');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Calculate time threshold
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - hours);

    // Get comprehensive product data
    const products = await (prisma.product as any).findMany({
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
            },
            avail: {
              include: {
                store: true
              }
            },
            _count: {
              select: {
                snapshots: true,
                events: true,
                avail: true
              }
            }
          }
        }
      }
    });

    // Process data
    let totalVariants = 0;
    let variantsWithData = 0;
    let recentUpdates = 0;
    let staleProducts = 0;

    const recentActivity: StockStatusResponse['recentActivity'] = [];
    const staleProductsList: StockStatusResponse['staleProducts'] = [];

    for (const product of products) {
      for (const variant of product.variants) {
        totalVariants++;
        
        const latestSnapshot = variant.snapshots[0];
        const latestEvent = variant.events[0];
        const storeCount = variant._count.avail;

        if (latestSnapshot || latestEvent || storeCount > 0) {
          variantsWithData++;
        }

        const lastUpdateTime = latestSnapshot?.seenAt || null;
        const isRecent = lastUpdateTime && lastUpdateTime > hoursAgo;

        if (isRecent) {
          recentUpdates++;
          
          if (recentActivity.length < limit) {
            const status = latestSnapshot?.inStock ? 'IN_STOCK' : 'OUT_OF_STOCK';
            const price = latestSnapshot?.price?.toString() || null;
            
            recentActivity.push({
              productId: product.id,
              productTitle: product.title,
              retailerName: product.retailer.name,
              variantId: variant.id,
              status,
              price,
              lastUpdate: lastUpdateTime!.toISOString(),
              eventType: latestEvent?.eventType,
              storeCount
            });
          }
        } else {
          staleProducts++;
          
          if (staleProductsList.length < limit) {
            staleProductsList.push({
              productId: product.id,
              productTitle: product.title,
              retailerName: product.retailer.name,
              variantId: variant.id,
              lastUpdate: lastUpdateTime?.toISOString() || null,
              totalSnapshots: variant._count.snapshots
            });
          }
        }
      }
    }

    // Check data integrity
    const [orphanSnapshots, orphanEvents, orphanAvailabilities] = await Promise.all([
      (prisma.inventorySnapshot as any).count({
        where: {
          variant: null
        }
      }),
      (prisma.stockEvent as any).count({
        where: {
          variant: null
        }
      }),
      (prisma.storeAvailability as any).count({
        where: {
          variant: null
        }
      })
    ]);

    const response: StockStatusResponse = {
      summary: {
        totalProducts: products.length,
        totalVariants,
        variantsWithData,
        recentUpdates,
        staleProducts
      },
      recentActivity: recentActivity.sort((a, b) => 
        new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime()
      ),
      staleProducts: staleProductsList.sort((a, b) => {
        if (!a.lastUpdate && !b.lastUpdate) return 0;
        if (!a.lastUpdate) return 1;
        if (!b.lastUpdate) return -1;
        return new Date(a.lastUpdate).getTime() - new Date(b.lastUpdate).getTime();
      }),
      dataIntegrity: {
        orphanSnapshots,
        orphanEvents,
        orphanAvailabilities
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Stock status error:", error);
    return NextResponse.json(
      { error: "Failed to get stock status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === "cleanup_orphans") {
      // Clean up orphaned records
      const [deletedSnapshots, deletedEvents, deletedAvailabilities] = await Promise.all([
        (prisma.inventorySnapshot as any).deleteMany({
          where: {
            variant: null
          }
        }),
        (prisma.stockEvent as any).deleteMany({
          where: {
            variant: null
          }
        }),
        (prisma.storeAvailability as any).deleteMany({
          where: {
            variant: null
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        cleaned: {
          snapshots: deletedSnapshots.count,
          events: deletedEvents.count,
          availabilities: deletedAvailabilities.count
        }
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );

  } catch (error) {
    console.error("Stock status action error:", error);
    return NextResponse.json(
      { error: "Failed to perform action" },
      { status: 500 }
    );
  }
}