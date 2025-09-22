'use server'

import { prisma } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getProducts() {
  try {
    const products = await (prisma.product as any).findMany({
      include: { 
        retailer: true, 
        variants: { 
          include: { 
            snapshots: { 
              orderBy: { id: "desc" }, 
              take: 1 
            },
            avail: {
              include: { store: true }
            }
          } 
        } 
      }
    })
    
    return products
  } catch (error) {
    console.error("Error fetching products:", error)
    throw new Error("Failed to fetch products")
  }
}

export async function getStores() {
  try {
    const stores = await (prisma.store as any).findMany({ 
      include: { retailer: true },
      orderBy: [
        { retailer: { name: "asc" } },
        { state: "asc" },
        { suburb: "asc" },
        { name: "asc" }
      ]
    })
    
    return stores
  } catch (error) {
    console.error("Error fetching stores:", error)
    throw new Error("Failed to fetch stores")
  }
}

export async function getEvents() {
  try {
    const events = await (prisma.stockEvent as any).findMany({
      orderBy: { id: "desc" },
      take: 50,
      include: { 
        variant: { 
          include: { 
            product: { 
              include: { retailer: true }
            }
          }
        }
      }
    })
    
    return events
  } catch (error) {
    console.error("Error fetching events:", error)
    throw new Error("Failed to fetch events")
  }
}

export async function createProduct(formData: FormData) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new Error("Unauthorized")
    }
    
    const retailer = formData.get("retailer") as string
    const baseUrl = formData.get("baseUrl") as string
    const platform = formData.get("platform") as string
    const title = formData.get("title") as string
    const url = formData.get("url") as string
    const sku = formData.get("sku") as string
    
    if (!retailer || !baseUrl || !platform || !title || !url) {
      throw new Error("Missing required fields")
    }
    
    // Upsert retailer
    const retailerRecord = await prisma.retailer.upsert({
      where: { name: retailer },
      update: {},
      create: { name: retailer, baseUrl, platform }
    })
    
    // Create product
    const product = await prisma.product.create({ 
      data: { 
        retailerId: retailerRecord.id, 
        title, 
        url, 
        sku 
      }
    })
    
    // Create initial variant
    await prisma.productVariant.create({ 
      data: { productId: product.id }
    })
    
    revalidatePath("/products")
    return { success: true, id: product.id }
  } catch (error) {
    console.error("Error creating product:", error)
    throw new Error(error instanceof Error ? error.message : "Failed to create product")
  }
}