import Bull from "bull"
import { scrapeCompetitor } from "@/lib/scraper"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

// Create separate queues for different tasks
export const scrapeQueue = new Bull("scrape-queue", REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    timeout: 900000, // 15 minutes - increased timeout
  },
  settings: {
    stalledInterval: 60000, // Increased to 1 minute
    maxStalledCount: 3,
    lockDuration: 900000, // 15 minutes - increased lock duration
    drainDelay: 5,
  },
  redis: {
    connectTimeout: 30000, // Increased Redis connection timeout
    maxRetriesPerRequest: 5,
    enableReadyCheck: false, // Disable ready check for better performance
  },
})

// Process scraping jobs with concurrency limit of 1 to avoid resource contention
scrapeQueue.process(1, async (job) => {
  const { competitorId } = job.data
  console.log(`Processing scrape task for competitor ID: ${competitorId}`)
  job.progress(10)

  try {
    // Run the scraping operation
    const result = await scrapeCompetitor(competitorId)
    job.progress(100)

    // Count total ads scraped
    const totalAds = Object.values(result.results || {}).flat().length
    console.log(`Scraped ${totalAds} ads for competitor ID ${competitorId}`)

    return result
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error)
    throw error
  }
})

// Event handlers for scrape queue
scrapeQueue.on("failed", (job, err) => {
  if (!job) {
    console.error("Failed job is null:", err)
    return
  }
  console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts:`, err)
})

scrapeQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed successfully`)
  if (result && result.results) {
    const totalAds = Object.values(result.results).flat().length
    console.log(`Scraped ${totalAds} ads for competitor ID ${result.competitorId}`)
  }
})

scrapeQueue.on("stalled", (job) => {
  console.warn(`Job ${job.id} has stalled and will be reprocessed`)
})

scrapeQueue.on("error", (error) => {
  console.error("Queue error:", error)
})

// Clean up old jobs periodically
scrapeQueue.on("completed", async () => {
  const MAX_QUEUE_SIZE = 1000
  const jobCounts = await scrapeQueue.getJobCounts()
  if (jobCounts.waiting + jobCounts.active + jobCounts.completed > MAX_QUEUE_SIZE) {
    console.log("Queue size exceeded. Trimming old jobs...")
    const jobs = await scrapeQueue.getCompleted(0, MAX_QUEUE_SIZE - 1)
    for (const job of jobs) {
      await scrapeQueue.removeJobs(String(job.id))
    }
  }
})

// Graceful shutdown function
export async function closeQueues() {
  console.log("Closing queues...")
  await scrapeQueue.close()
  console.log("Queues closed")
}

// Handle process termination
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing queues...")
  await closeQueues()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing queues...")
  await closeQueues()
  process.exit(0)
})
