import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scrapeQueue } from "@/lib/queue";

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params; // Await params
    const competitorId = Number.parseInt(params.id);

    if (isNaN(competitorId)) {
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 });
    }

    // Check if competitor exists
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    });

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    // Check if there's already a job in the queue for this competitor
    const activeJobs = await scrapeQueue.getJobs(["active", "waiting"]);
    const existingJob = activeJobs.find((job) => job.data && job.data.competitorId === competitorId);

    if (existingJob) {
      return NextResponse.json({
        message: "Scraping already in progress for this competitor",
        jobId: existingJob.id,
      });
    }

    // Add the scraping job to the queue
    const job = await scrapeQueue.add(
      { competitorId },
      {
        jobId: `competitor-${competitorId}-${Date.now()}`,
        attempts: 3,
        priority: 1,
      }
    );

    // Update the competitor record to show scraping has started
    await db
      .update(competitors)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(competitors.id, competitorId));

    return NextResponse.json({
      message: "Scraping job added to queue",
      jobId: job.id,
      competitorId,
    });
  } catch (error) {
    console.error(`Error scheduling scrape for competitor ${context.params.id}:`, error);
    return NextResponse.json({ error: "Failed to schedule competitor scraping" }, { status: 500 });
  }
}

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params; // Await params
    const competitorId = Number.parseInt(params.id);

    if (isNaN(competitorId)) {
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 });
    }

    // Check if competitor exists
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    });

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    // Check if there's a job in the queue for this competitor
    const activeJobs = await scrapeQueue.getJobs(["active", "waiting"]);
    const existingJob = activeJobs.find((job) => job.data && job.data.competitorId === competitorId);

    if (existingJob) {
      const jobState = await existingJob.getState();
      const progress = await existingJob.progress();

      return NextResponse.json({
        status: "in_progress",
        jobId: existingJob.id,
        state: jobState,
        progress,
        lastScraped: competitor.lastScraped,
      });
    }

    // No active job, return the last scraped info
    return NextResponse.json({
      status: "completed",
      lastScraped: competitor.lastScraped,
      competitorId,
    });
  } catch (error) {
    console.error(`Error checking scrape status for competitor ${context.params.id}:`, error);
    return NextResponse.json({ error: "Failed to check scraping status" }, { status: 500 });
  }
}