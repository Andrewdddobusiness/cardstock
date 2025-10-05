import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Test endpoint to verify database connectivity and basic stock data queries
 * GET /api/stock/test
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const includeData = url.searchParams.get('data') === 'true';

    // Basic connectivity test
    const startTime = Date.now();
    
    // Test database connection with a simple query
    await prisma.$queryRaw`SELECT 1 as test`;
    
    const connectionTime = Date.now() - startTime;

    // Get basic counts
    const counts = await Promise.all([
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.inventorySnapshot.count(),
      prisma.stockEvent.count(),
      prisma.storeAvailability.count(),
      prisma.retailer.count(),
      prisma.store.count()
    ]);

    const [products, variants, snapshots, events, storeAvails, retailers, stores] = counts;

    const response: any = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        connectionTime: `${connectionTime}ms`
      },
      counts: {
        products,
        variants,
        snapshots,
        events,
        storeAvailabilities: storeAvails,
        retailers,
        stores
      }
    };

    if (includeData) {
      // Include sample data for verification
      const [sampleProducts, recentSnapshots, recentEvents] = await Promise.all([
        prisma.product.findMany({
          take: 3,
          include: {
            retailer: true,
            variants: {
              take: 1,
              include: {
                snapshots: {
                  take: 1,
                  orderBy: { seenAt: 'desc' }
                }
              }
            }
          }
        }),
        prisma.inventorySnapshot.findMany({
          take: 3,
          orderBy: { seenAt: 'desc' },
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    retailer: true
                  }
                }
              }
            }
          }
        }),
        prisma.stockEvent.findMany({
          take: 3,
          orderBy: { occurredAt: 'desc' },
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    retailer: true
                  }
                }
              }
            }
          }
        })
      ]);

      response.sampleData = {
        products: sampleProducts.map(p => ({
          id: p.id,
          title: p.title.substring(0, 50) + (p.title.length > 50 ? '...' : ''),
          retailer: p.retailer.name,
          url: p.url,
          variantCount: p.variants.length,
          latestSnapshot: p.variants[0]?.snapshots[0] ? {
            inStock: p.variants[0].snapshots[0].inStock,
            price: p.variants[0].snapshots[0].price?.toString(),
            seenAt: p.variants[0].snapshots[0].seenAt.toISOString()
          } : null
        })),
        recentSnapshots: recentSnapshots.map(s => ({
          id: s.id,
          inStock: s.inStock,
          price: s.price?.toString(),
          seenAt: s.seenAt.toISOString(),
          product: {
            title: s.variant.product.title.substring(0, 50) + (s.variant.product.title.length > 50 ? '...' : ''),
            retailer: s.variant.product.retailer.name
          }
        })),
        recentEvents: recentEvents.map(e => ({
          id: e.id,
          eventType: e.eventType,
          occurredAt: e.occurredAt.toISOString(),
          product: {
            title: e.variant.product.title.substring(0, 50) + (e.variant.product.title.length > 50 ? '...' : ''),
            retailer: e.variant.product.retailer.name
          },
          details: e.details
        }))
      };
    }

    // Performance metrics
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [recentSnapshotsCount, recentEventsCount] = await Promise.all([
      prisma.inventorySnapshot.count({
        where: { seenAt: { gte: oneHourAgo } }
      }),
      prisma.stockEvent.count({
        where: { occurredAt: { gte: oneHourAgo } }
      })
    ]);

    const [dailySnapshotsCount, dailyEventsCount] = await Promise.all([
      prisma.inventorySnapshot.count({
        where: { seenAt: { gte: oneDayAgo } }
      }),
      prisma.stockEvent.count({
        where: { occurredAt: { gte: oneDayAgo } }
      })
    ]);

    response.activity = {
      lastHour: {
        snapshots: recentSnapshotsCount,
        events: recentEventsCount
      },
      last24Hours: {
        snapshots: dailySnapshotsCount,
        events: dailyEventsCount
      }
    };

    // System health indicators
    const health = [];
    
    if (variants === 0) {
      health.push({ level: 'warning', message: 'No product variants found' });
    }
    
    if (snapshots === 0) {
      health.push({ level: 'warning', message: 'No inventory snapshots found' });
    }
    
    if (dailySnapshotsCount === 0) {
      health.push({ level: 'warning', message: 'No recent snapshots in the last 24 hours' });
    }
    
    if (recentSnapshotsCount === 0 && snapshots > 0) {
      health.push({ level: 'info', message: 'No snapshots in the last hour (monitoring may be idle)' });
    }

    if (health.length === 0) {
      health.push({ level: 'success', message: 'System appears healthy' });
    }

    response.health = health;

    return NextResponse.json(response);

  } catch (error) {
    console.error("Stock test error:", error);
    
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      health: [
        { level: 'error', message: 'Database connection failed' }
      ]
    }, { status: 500 });
  }
}