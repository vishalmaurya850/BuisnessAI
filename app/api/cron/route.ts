import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { scrapeCompetitor } from "@/lib/scraper"
import { generateInsightFromRecentActivity } from "@/lib/insights"

export const runtime = "nodejs";

// This endpoint is meant to be called by a CRON job every 6-12 hours
export async function POST(request: Request) {
  try {
    // Verify the request is from a legitimate CRON service using a secret token
    const authHeader = request.headers.get("Authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error("Unauthorized CRON job attempt")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Initialize the scraper (removed initScraper as it is not exported)
    console.log("Scraper initialization skipped")

    try {
      // Get all active competitors
      const allCompetitors = await db.query.competitors.findMany()

      console.log(`Starting CRON job to scrape ${allCompetitors.length} competitors`)

      // Track results
      const results: {
        total: number
        successful: number
        failed: number
        details: Array<{
          id: number
          name: string
          success: boolean
          error?: string
        }>
      } = {
        total: allCompetitors.length,
        successful: 0,
        failed: 0,
        details: [],
      }

      // Scrape each competitor
      for (const competitor of allCompetitors) {
        try {
          console.log(`Scraping competitor: ${competitor.name} (ID: ${competitor.id})`)
          const result = await scrapeCompetitor(competitor.id)

          if (result.success) {
            results.successful++
          } else {
            results.failed++
          }

          results.details.push({
            id: competitor.id,
            name: competitor.name,
            success: result.success,
            error: result.error,
          })
        } catch (error) {
          console.error(`Error scraping competitor ${competitor.id}:`, error)
          results.failed++
          results.details.push({
            id: competitor.id,
            name: competitor.name,
            success: false,
            error: (error as Error).message,
          })
        }
      }

      // Generate insights based on recent activity
      if (results.successful > 0) {
        try {
          // For each business with competitors, generate an insight
          const businesses = await db.query.businesses.findMany()

          for (const business of businesses) {
            await generateInsightFromRecentActivity(business.id)
          }

          console.log("Generated insights based on recent activity")
        } catch (error) {
          console.error("Error generating insights:", error)
        }
      }

      return NextResponse.json(results)
    } finally {
      // Scraper cleanup skipped as closeScrape is not available
      console.log("Scraper cleanup skipped")
    }
  } catch (error) {
    console.error("Error in CRON job:", error)
    return NextResponse.json({ error: "Failed to run CRON job" }, { status: 500 })
  }
}