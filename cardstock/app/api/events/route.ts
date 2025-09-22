import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const events = await prisma.stockEvent.findMany({
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
    });
    
    // Details are already JSON objects with PostgreSQL
    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}