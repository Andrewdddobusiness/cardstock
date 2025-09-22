import { NextRequest, NextResponse } from "next/server";
import { adapters } from "@/lib/retailers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const platform = searchParams.get('platform') || 'genericDom';
  
  if (!url) {
    return NextResponse.json({ error: "URL parameter required" }, { status: 400 });
  }
  
  try {
    const adapter = adapters[platform] || adapters.genericDom;
    const result = await adapter(url);
    
    return NextResponse.json({
      success: true,
      url,
      platform,
      result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      url,
      platform,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}