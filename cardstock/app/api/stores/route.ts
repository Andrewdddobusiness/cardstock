import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const stores = await prisma.store.findMany({ 
      include: { retailer: true },
      orderBy: [
        { retailer: { name: "asc" } },
        { state: "asc" },
        { suburb: "asc" },
        { name: "asc" }
      ]
    });
    
    return NextResponse.json(stores);
  } catch (error) {
    console.error("Error fetching stores:", error);
    return NextResponse.json(
      { error: "Failed to fetch stores" },
      { status: 500 }
    );
  }
}