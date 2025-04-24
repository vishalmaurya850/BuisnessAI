import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { scrapeQueue } from "@/lib/queue"
import { generateInsightFromRecentActivity } from "@/lib/insights"

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

    // Get all active competitors
    const allCompetitors = await db.query.competitors.findMany()

    console.log(`Starting CRON job to scrape ${allCompetitors.length} competitors`)

    // Track results
    const results = {
      total: allCompetitors.length,
      scheduled: 0,
      skipped: 0,
      details: [] as Array<{
        id: number
        name: string
        status: string
        reason?: string
      }>,
    }

    // Check existing jobs to avoid duplicates
    const activeJobs = await scrapeQueue.getJobs(["active", "waiting"])
    const activeCompetitorIds = new Set(activeJobs.map((job) => job.data?.competitorId).filter(Boolean))

    // Add scraping jobs to the queue with a delay between them
    for (let i = 0; i < allCompetitors.length; i++) {
      const competitor = allCompetitors[i]

      // Skip if already in queue
      if (activeCompetitorIds.has(competitor.id)) {
        results.skipped++
        results.details.push({
          id: competitor.id,
          name: competitor.name,
          status: "skipped",
          reason: "Already in queue",
        })
        continue
      }

      // Add to queue with staggered delay to prevent overwhelming the system
      await scrapeQueue.add(
        { competitorId: competitor.id },
        {
          jobId: `cron-competitor-${competitor.id}-${Date.now()}`,
          delay: i * 30000, // 30 seconds between each job
          attempts: 3,
        },
      )

      results.scheduled++
      results.details.push({
        id: competitor.id,
        name: competitor.name,
        status: "scheduled",
      })
    }

    // Generate insights based on recent activity
    // This runs independently of the scraping jobs
    try {
      // For each business with competitors, generate an insight
      const businesses = await db.query.businesses.findMany()

      for (const business of businesses) {
        await generateInsightFromRecentActivity(business.id, business.id)
      }

      console.log("Generated insights based on recent activity")
    } catch (error) {
      console.error("Error generating insights:", error)
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error in CRON job:", error)
    return NextResponse.json({ error: "Failed to run CRON job" }, { status: 500 })
  }
}