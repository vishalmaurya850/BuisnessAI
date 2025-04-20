import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { scrapeCompetitor } from "@/lib/scraper"
import { db } from "@/lib/db"

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.competitorId) {
      return NextResponse.json({ error: "Missing competitorId" }, { status: 400 })
    }

    // Check if competitor exists
    const competitor = await db.query.competitors.findFirst({
      where: (competitors, { eq }) => eq(competitors.id, body.competitorId),
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    // Start the scraping process
    const results = await scrapeCompetitor(body.competitorId)

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error in scraper API:", error)
    return NextResponse.json({ error: "Failed to scrape competitor data" }, { status: 500 })
  }
}

// GET endpoint to retrieve scraping status or results
export async function GET(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const competitorId = url.searchParams.get("competitorId")

    if (!competitorId) {
      return NextResponse.json({ error: "Missing competitorId" }, { status: 400 })
    }

    // Get the latest ads for this competitor
    const latestAds = await db.query.ads.findMany({
      where: (ads, { eq }) => eq(ads.competitorId, Number.parseInt(competitorId)),
      orderBy: (ads, { desc }) => [desc(ads.updatedAt)],
      limit: 10,
    })

    return NextResponse.json({
      competitorId,
      lastScraped: latestAds.length > 0 ? latestAds[0].updatedAt : null,
      adCount: latestAds.length,
    })
  } catch (error) {
    console.error("Error retrieving scraper status:", error)
    return NextResponse.json({ error: "Failed to retrieve scraper status" }, { status: 500 })
  }
}
