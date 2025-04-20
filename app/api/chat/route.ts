import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { generateChatResponse } from "@/lib/ai"
import { db } from "@/lib/db"
import { ads, competitors } from "@/lib/db/schema"
import { desc, like } from "drizzle-orm"

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 })
    }

    const message = body.message.trim()

    // Process specific queries with database lookups
    let response = ""

    // Check for competitor-specific queries
    const competitorMatch = message.match(/competitor\s+([A-Za-z]+)/i) || message.match(/from\s+([A-Za-z]+)/i)

    if (competitorMatch) {
      const competitorName = competitorMatch[1]

      // Look up the competitor
      const competitor = await db.query.competitors.findFirst({
        where: like(competitors.name, `%${competitorName}%`),
      })

      if (competitor) {
        // Check for ad type queries
        if (message.toLowerCase().includes("video ad") || message.toLowerCase().includes("video ads")) {
          const videoAds = await db.query.ads.findMany({
            where: (ads, { eq, and }) => and(eq(ads.competitorId, competitor.id), eq(ads.type, "video")),
            orderBy: [desc(ads.firstSeen)],
            limit: 5,
          })

          if (videoAds.length > 0) {
            response = `I found ${videoAds.length} video ads from ${competitor.name}:\n\n`
            videoAds.forEach((ad, i) => {
              response += `${i + 1}. "${ad.content.substring(0, 100)}${ad.content.length > 100 ? "..." : ""}"\n`
              response += `   First seen: ${ad.firstSeen.toLocaleDateString()}\n`
              response += `   Platform: ${ad.platform}\n\n`
            })
          } else {
            response = `I couldn't find any video ads from ${competitor.name}.`
          }

          return NextResponse.json({ response })
        }
      }
    }

    // Check for general queries about competitors
    if (
      message.toLowerCase().includes("competitors this week") ||
      message.toLowerCase().includes("competitors doing")
    ) {
      // Get recent ads from the past week
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const recentAds = await db.query.ads.findMany({
        where: (ads, { gte }) => gte(ads.firstSeen, oneWeekAgo),
        orderBy: [desc(ads.firstSeen)],
        limit: 10,
      })

      if (recentAds.length > 0) {
        // Get competitor details
        const competitorIds = [...new Set(recentAds.map((ad) => ad.competitorId))]
        const competitorDetails = await db.query.competitors.findMany({
          where: (competitors, { inArray }) => inArray(competitors.id, competitorIds),
        })

        // Group ads by competitor
        const adsByCompetitor: Record<number, typeof recentAds> = {}
        recentAds.forEach((ad) => {
          if (!adsByCompetitor[ad.competitorId]) {
            adsByCompetitor[ad.competitorId] = []
          }
          adsByCompetitor[ad.competitorId].push(ad)
        })

        response = `Here's what your competitors have been doing this week:\n\n`

        for (const competitorId of competitorIds) {
          const competitor = competitorDetails.find((c) => c.id === competitorId)
          const ads = adsByCompetitor[competitorId]

          if (competitor && ads) {
            response += `${competitor.name}:\n`
            response += `- ${ads.length} new ad${ads.length > 1 ? "s" : ""}\n`
            response += `- Platforms: ${[...new Set(ads.map((ad) => ad.platform))].join(", ")}\n`
            response += `- Ad types: ${[...new Set(ads.map((ad) => ad.type))].join(", ")}\n\n`
          }
        }
      } else {
        response = "I couldn't find any competitor activity from the past week."
      }

      return NextResponse.json({ response })
    }

    // If no specific query was matched, use the AI to generate a response
    response = await generateChatResponse(message, userId)

    return NextResponse.json({ response })
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json({ error: "Failed to process chat message" }, { status: 500 })
  }
}
