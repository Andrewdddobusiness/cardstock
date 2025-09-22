import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
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
    });
    
    return NextResponse.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { retailer, baseUrl, platform, title, url, sku } = await req.json();
    
    if (!retailer || !baseUrl || !platform || !title || !url) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Upsert retailer
    const retailerRecord = await prisma.retailer.upsert({
      where: { name: retailer },
      update: {},
      create: { name: retailer, baseUrl, platform }
    });
    
    // Create product
    const product = await prisma.product.create({ 
      data: { 
        retailerId: retailerRecord.id, 
        title, 
        url, 
        sku 
      }
    });
    
    // Create initial variant
    await prisma.productVariant.create({ 
      data: { productId: product.id }
    });
    
    return NextResponse.json({ ok: true, id: product.id });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}