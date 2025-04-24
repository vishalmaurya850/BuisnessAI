import { db } from "@/lib/db"
import { insights, ads, competitors } from "@/lib/db/schema"
import { desc, eq, and, gte } from "drizzle-orm"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { InsightData } from "@/lib/types"

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function generateInsightFromRecentActivity(businessId: number, userId: number): Promise<InsightData | null> {
  try {
    // Get competitors for this business
    const businessCompetitors = await db.query.competitors.findMany({
      where: eq(competitors.businessId, businessId),
    })

    if (businessCompetitors.length === 0) {
      console.log(`No competitors found for business ${businessId}`)
      return null
    }

    const competitorIds = businessCompetitors.map((c) => c.id)

    // Get recent ads from the past week
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const recentAds = await db.query.ads.findMany({
      where: and(eq(ads.isActive, true), gte(ads.firstSeen, oneWeekAgo)),
      orderBy: [desc(ads.firstSeen)],
      limit: 50,
    })

    // Filter ads for this business's competitors
    const relevantAds = recentAds.filter((ad) => competitorIds.includes(ad.competitorId))

    if (relevantAds.length === 0) {
      console.log(`No recent ads found for business ${businessId}`)
      return null
    }

    // Prepare data for AI analysis
    const adSummary = await Promise.all(
      relevantAds.map(async (ad) => {
        const competitor = businessCompetitors.find((c) => c.id === ad.competitorId)

        return {
          competitorName: competitor?.name || "Unknown",
          platform: ad.platform,
          type: ad.type,
          content: ad.content.substring(0, 100) + (ad.content.length > 100 ? "..." : ""),
          firstSeen: ad.firstSeen,
          aiAnalysis: ad.aiAnalysis,
        }
      }),
    )

    // Group ads by competitor
    const adsByCompetitor: Record<string, typeof adSummary> = {}
    adSummary.forEach((ad) => {
      if (!adsByCompetitor[ad.competitorName]) {
        adsByCompetitor[ad.competitorName] = []
      }
      adsByCompetitor[ad.competitorName].push(ad)
    })

    // Generate insight using AI
    const prompt = `
      Based on the following recent competitor ad data, generate a strategic insight and recommendation:
      
      ${JSON.stringify(adsByCompetitor, null, 2)}
      
      Format your response as JSON with these fields:
      - title: A concise title for the insight (max 80 characters)
      - description: A detailed explanation of the insight (max 300 characters)
      - recommendation: A specific, actionable recommendation based on the insight (max 200 characters)
    `

    // Use Gemini for insight generation
    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash-8b-latest" })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Parse the AI response
    let aiResponse: {
      title: string
      description: string
      recommendation: string
    }

    try {
      // Extract JSON from response if it's wrapped in code blocks
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*?}/)
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]) as {
          title: string
          description: string
          recommendation: string
        }
      } else {
        aiResponse = JSON.parse(text) as {
          title: string
          description: string
          recommendation: string
        }
      }
    } catch (e) {
      console.error("Error parsing AI response:", e)
      // If parsing fails, create a generic insight
      aiResponse = {
        title: "New Competitor Activity Detected",
        description: "There has been new activity from your competitors recently.",
        recommendation: "Review the latest ads to identify trends and opportunities.",
      }
    }

    // Create the insight
    const [newInsight] = await db
      .insert(insights)
      .values({
        userId: userId.toString(),
        businessId,
        title: aiResponse.title,
        description: aiResponse.description,
        recommendation: aiResponse.recommendation,
      })
      .returning()

    return newInsight as unknown as InsightData
  } catch (error) {
    console.error("Error generating insight:", error)
    return null
  }
}

export async function markInsightAsApplied(insightId: number, isApplied: boolean): Promise<InsightData> {
  try {
    const [updatedInsight] = await db.update(insights).set({ isApplied }).where(eq(insights.id, insightId)).returning()

    return updatedInsight as unknown as InsightData
  } catch (error) {
    console.error("Error updating insight:", error)
    throw error
  }
}

export async function getInsightsForBusiness(businessId: number, limit = 10, offset = 0): Promise<InsightData[]> {
  try {
    const businessInsights = await db.query.insights.findMany({
      where: eq(insights.businessId, businessId),
      orderBy: [desc(insights.createdAt)],
      limit,
      offset,
    })

    return businessInsights as unknown as InsightData[]
  } catch (error) {
    console.error("Error fetching insights:", error)
    throw error
  }
}
