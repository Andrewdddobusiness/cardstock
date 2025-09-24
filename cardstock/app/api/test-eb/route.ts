import { NextRequest, NextResponse } from "next/server";
import { checkEB } from "@/lib/retailers/ebgames";

export async function GET(request: NextRequest) {
  const url = 'https://www.ebgames.com.au/product/toys-and-collectibles/334665-pokemon-tcg-mega-venusaur-ex-premium-collection-box';
  
  try {
    console.log('Testing EB Games scraper with URL:', url);
    const result = await checkEB(url);
    console.log('Scraping result:', JSON.stringify(result, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      result,
      message: "EB Games scraper test completed"
    });
    
  } catch (error) {
    console.error('Error testing EB Games scraper:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      message: "EB Games scraper test failed"
    }, { status: 500 });
  }
}