import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { competitors } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { crawlCompetitorWebsite, processScrapedWebsiteAds } from "@/lib/scraper/website-crawler"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const competitorId = Number.parseInt(params.id)

    if (isNaN(competitorId)) {
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 })
    }

    // Check if competitor exists and belongs to the current user
    const competitor = await db.query.competitors.findFirst({
      where: and(eq(competitors.id, competitorId), eq(competitors.userId, userId)),
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    // Start the website crawling process
    console.log(`Starting website crawl for competitor: ${competitor.name}`)

    // Crawl the competitor's website
    const scrapedAds = await crawlCompetitorWebsite(competitorId, 15) // Crawl up to 15 pages

    // Process and store the scraped ads
    const results = await processScrapedWebsiteAds(competitorId, scrapedAds, userId) // Added userId

    // Update the competitor record to show crawling has completed
    await db
      .update(competitors)
      .set({
        lastScraped: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(competitors.id, competitorId), eq(competitors.userId, userId)))

    return NextResponse.json({
      success: true,
      competitorId,
      results: {
        adsFound: scrapedAds.length,
        adsAdded: results.added,
        adsUpdated: results.updated,
        errors: results.errors,
      },
    })
  } catch (error) {
    console.error(`Error crawling website for competitor ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to crawl competitor website" }, { status: 500 })
  }
}