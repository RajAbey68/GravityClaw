import { NextResponse } from "next/server";
import { getAppContainer } from "@/src/core/container";

export async function GET() {
  try {
    const container = await getAppContainer();
    
    // We assume the container will soon have the pinecone service
    // For now, we return a mock or actual status if available
    const pinecone = (container as any).pinecone;
    
    if (!pinecone || !pinecone.isEnabled) {
      return NextResponse.json({ 
        enabled: false, 
        message: "Pinecone is not configured or disabled in environment." 
      });
    }

    // Trigger a dry-run or get stats
    const stats = await pinecone.sync(0); // sync(0) just to trigger connection check if needed

    return NextResponse.json({
      enabled: true,
      index: pinecone.indexName,
      stats
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
