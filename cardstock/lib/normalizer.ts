import { prisma } from "./db";
import { fp } from "./hashing";
import { Decimal } from "@prisma/client/runtime/library";

interface StoreAvail {
  storeCode: string;
  storeName: string; 
  inStock: boolean;
}

interface VariantData {
  inStock: boolean;
  price: number | null;
  storeAvails?: StoreAvail[];
}

export async function applyResult(productId: string, variantId: string, v: VariantData) {
  // 1) Process per-store availability
  if (v.storeAvails?.length) {
    for (const s of v.storeAvails) {
      // Get product to find retailer
      const product = await prisma.product.findUnique({ 
        where: { id: productId }, 
        include: { retailer: true }
      });
      
      if (!product) continue;
      
      // Ensure store exists
      const store = await prisma.store.upsert({
        where: { 
          retailerId_storeCode: { 
            retailerId: product.retailerId, 
            storeCode: s.storeCode 
          }
        },
        create: { 
          retailerId: product.retailerId, 
          storeCode: s.storeCode, 
          name: s.storeName 
        },
        update: {}
      });
      
      // Update availability
      await prisma.storeAvailability.upsert({
        where: { 
          variantId_storeId: { 
            variantId, 
            storeId: store.id 
          }
        },
        create: { 
          variantId, 
          storeId: store.id, 
          inStock: s.inStock, 
          price: v.price ? new Decimal(v.price) : undefined 
        },
        update: { 
          inStock: s.inStock, 
          price: v.price ? new Decimal(v.price) : undefined, 
          seenAt: new Date() 
        }
      });
    }
  }

  // 2) Create snapshot and event if changed
  const fingerprint = fp({ 
    inStock: v.inStock, 
    price: v.price, 
    stores: (v.storeAvails || [])
      .map(s => `${s.storeCode}:${s.inStock}`)
      .sort() 
  });
  
  const lastSnapshot = await prisma.inventorySnapshot.findFirst({ 
    where: { variantId }, 
    orderBy: { id: "desc" }
  });
  
  if (!lastSnapshot || lastSnapshot.fingerprint !== fingerprint) {
    // Determine event type
    let eventType = "STATUS_FLIP";
    
    if (!lastSnapshot) {
      eventType = "STATUS_FLIP";
    } else if (v.inStock && !lastSnapshot.inStock) {
      eventType = "IN_STOCK";
    } else if (!v.inStock && lastSnapshot.inStock) {
      eventType = "OUT_OF_STOCK";
    } else if (v.price && lastSnapshot.price && new Decimal(v.price).lessThan(lastSnapshot.price)) {
      eventType = "PRICE_DROP";
    }
    
    // Create event
    await prisma.stockEvent.create({ 
      data: { 
        variantId, 
        eventType, 
        details: JSON.stringify({ 
          prev: lastSnapshot ? {
            inStock: lastSnapshot.inStock,
            price: lastSnapshot.price?.toString()
          } : null, 
          cur: {
            inStock: v.inStock,
            price: v.price
          }
        })
      }
    });
    
    // Create new snapshot
    await prisma.inventorySnapshot.create({ 
      data: { 
        variantId, 
        inStock: v.inStock, 
        price: v.price ? new Decimal(v.price) : undefined, 
        fingerprint 
      }
    });
  }
}