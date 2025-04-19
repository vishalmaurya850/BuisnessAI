import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { insights, ads } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function GET(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get("limit") || "10")
    const offset = Number.parseInt(url.searchParams.get("offset") || "0")

    // In a real app, we would filter by the user's business ID
    const insightResults = await db
      .select()
      .from(insights)
      .orderBy(desc(insights.createdAt))
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql`COUNT(*)` })
      .from(insights)

    return NextResponse.json({
      insights: insightResults,
      total: Number(count),
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching insights:", error)
    return NextResponse.json({ error: "Failed to fetch insights" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Check if we need to generate an insight
    if (body.generate) {
      // In a real app, we would get the business ID from the user's profile
      const businessId = 1 // Placeholder

      // Get recent ads to analyze
      const recentAds = await db.query.ads.findMany({
        orderBy: [desc(ads.firstSeen)],
        limit: 50,
      })

      // Get competitor information
      const competitorInfo = await db.query.competitors.findMany()

      // Prepare data for AI analysis
      const adSummary = recentAds.map((ad) => ({
        competitorName: competitorInfo.find((c) => c.id === ad.competitorId)?.name || "Unknown",
        platform: ad.platform,
        type: ad.type,
        content: ad.content.substring(0, 100),
        firstSeen: ad.firstSeen,
      }))

      // Generate insight using AI
      const prompt = `
        Based on the following recent competitor ad data, generate a strategic insight and recommendation:
        
        ${JSON.stringify(adSummary, null, 2)}
        
        Format your response as JSON with these fields:
        - title: A concise title for the insight
        - description: A detailed explanation of the insight
        - recommendation: A specific, actionable recommendation based on the insight
      `

      const { text } = await generateText({
        model: openai("gpt-4o"),
        prompt,
      })

      // Parse the AI response
      let aiResponse
      try {
        aiResponse = JSON.parse(text)
      } catch {
        // If parsing fails, create a generic insight
        aiResponse = {
          title: "New Competitor Activity Detected",
          description: "There has been new activity from your competitors recently.",
          recommendation: "Review the latest ads to identify trends and opportunities.",
        }
      }

      // Create the insight
      const newInsight = await db
        .insert(insights)
        .values({
          businessId,
          title: aiResponse.title,
          description: aiResponse.description,
          recommendation: aiResponse.recommendation,
        })
        .returning()

      return NextResponse.json(newInsight[0], { status: 201 })
    } else {
      // Manual insight creation
      if (!body.title || !body.description || !body.recommendation) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }

      // In a real app, we would get the business ID from the user's profile
      const businessId = 1 // Placeholder

      const newInsight = await db
        .insert(insights)
        .values({
          businessId,
          title: body.title,
          description: body.description,
          recommendation: body.recommendation,
          isApplied: body.isApplied || false,
        })
        .returning()

      return NextResponse.json(newInsight[0], { status: 201 })
    }
  } catch (error) {
    console.error("Error creating insight:", error)
    return NextResponse.json({ error: "Failed to create insight" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.id) {
      return NextResponse.json({ error: "Missing insight ID" }, { status: 400 })
    }

    const updateData: Partial<{ isApplied: boolean }> = {}

    if (body.isApplied !== undefined) {
      updateData.isApplied = body.isApplied
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const updatedInsight = await db.update(insights).set(updateData).where(eq(insights.id, body.id)).returning()

    if (updatedInsight.length === 0) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 })
    }

    return NextResponse.json(updatedInsight[0])
  } catch (error) {
    console.error("Error updating insight:", error)
    return NextResponse.json({ error: "Failed to update insight" }, { status: 500 })
  }
}
