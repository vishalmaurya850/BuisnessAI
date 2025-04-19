import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { analyzeAdContent, analyzeImage, analyzeVideo } from "@/lib/ai"
import type { AdType } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.adContent || !body.adType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    let analysis

    // Analyze based on ad type
    if (body.adType === "image" && body.mediaUrl) {
      // For images, use Gemini Vision
      analysis = await analyzeImage(body.mediaUrl)
    } else if (body.adType === "video" && body.mediaUrl) {
      // For videos, use specialized video analysis
      analysis = await analyzeVideo(body.mediaUrl)
    } else {
      // For text or when no media URL is provided
      analysis = await analyzeAdContent(body.adContent, body.adType as AdType)
    }

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error("Error in AI analysis:", error)
    return NextResponse.json({ error: "Failed to analyze ad content" }, { status: 500 })
  }
}
