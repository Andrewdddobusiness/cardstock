import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { retailer, baseUrl, platform, title, url, sku } = body;
    
    if (!retailer || !baseUrl || !platform || !title || !url) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Upsert retailer
    const retailerRecord = await (prisma.retailer as any).upsert({
      where: { name: retailer },
      update: {},
      create: { name: retailer, baseUrl, platform }
    });
    
    // Create product
    const product = await (prisma.product as any).create({
      data: {
        retailerId: retailerRecord.id,
        title,
        url,
        sku: sku || null
      }
    });
    
    // Create initial variant
    await (prisma.productVariant as any).create({
      data: { productId: product.id }
    });
    
    return NextResponse.json({ 
      success: true, 
      id: product.id,
      message: "Product added successfully"
    });
    
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}