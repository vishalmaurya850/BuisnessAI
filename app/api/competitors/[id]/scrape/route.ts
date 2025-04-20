import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { scrapeQueue } from "@/lib/queue"
import { db } from "@/lib/db"
import { competitors } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const competitorId = Number.parseInt(resolvedParams.id)

    if (isNaN(competitorId)) {
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 })
    }

    // Check if competitor exists
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    // Check if there's already a job in the queue for this competitor
    const activeJobs = await scrapeQueue.getActive()
    const waitingJobs = await scrapeQueue.getWaiting()
    const allJobs = [...activeJobs, ...waitingJobs]

    const existingJob = allJobs.find((job) => job.data && job.data.competitorId === competitorId)

    if (existingJob) {
      return NextResponse.json(
        {
          message: "A scraping task for this competitor is already in progress",
          jobId: existingJob.id,
        },
        { status: 202 },
      )
    }

    // Enqueue the scraping task with high priority
    const job = await scrapeQueue.add(
      { competitorId },
      {
        priority: 1,
        jobId: `competitor-${competitorId}-${Date.now()}`,
      },
    )

    return NextResponse.json(
      {
        message: "Scraping task added to the queue",
        jobId: job.id,
      },
      { status: 202 },
    )
  } catch (error) {
    console.error(`Error enqueuing scraping task for competitor ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to enqueue scraping task" }, { status: 500 })
  }
}

// Add a GET endpoint to check job status
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const competitorId = Number.parseInt(resolvedParams.id)

    if (isNaN(competitorId)) {
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 })
    }

    // Check if competitor exists
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    // Check for active jobs for this competitor
    const activeJobs = await scrapeQueue.getActive()
    const waitingJobs = await scrapeQueue.getWaiting()
    const allJobs = [...activeJobs, ...waitingJobs]

    const existingJob = allJobs.find((job) => job.data && job.data.competitorId === competitorId)

    if (existingJob) {
      return NextResponse.json({
        status: "in_progress",
        jobId: existingJob.id,
        progress: await existingJob.progress(),
      })
    }

    // Check when the competitor was last scraped
    return NextResponse.json({
      status: "completed",
      lastScraped: competitor.lastScraped,
    })
  } catch (error) {
    console.error(`Error checking scrape status for competitor ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to check scrape status" }, { status: 500 })
  }
}