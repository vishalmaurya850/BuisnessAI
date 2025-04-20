import Bull from "bull"
import { scrapeCompetitor } from "@/lib/scraper"

// Replace with your deployed Redis URL
const REDIS_URL = process.env.REDIS_URL || "redis://<your-redis-url>"

// Initialize Redis-backed queue with optimized settings
export const scrapeQueue = new Bull("scrape-queue", REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: true, // Automatically remove completed jobs
    removeOnFail: true, // Automatically remove failed jobs
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      // Exponential backoff strategy
      type: "exponential",
      delay: 5000, // Initial delay of 5 seconds
    },
    timeout: 300000, // 5-minute timeout for jobs
  },
  settings: {
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    maxStalledCount: 2, // Consider a job stalled after 2 checks
    lockDuration: 300000, // Lock duration of 5 minutes
  },
})

// Process scraping tasks with concurrency limit
scrapeQueue.process(5, async (job) => {
  const { competitorId } = job.data
  console.log(`Processing scrape task for competitor ID: ${competitorId}`)

  // Update job progress
  job.progress(10)

  try {
    const result = await scrapeCompetitor(competitorId)
    job.progress(100)
    return result
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error)
    throw error
  }
})

// Add error handling
scrapeQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts:`, err)
})

// Add completion handling
scrapeQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed successfully`)

  // Log statistics about the scraping results
  if (result && result.results) {
    const totalAds = Object.values(result.results).flat().length

    console.log(`Scraped ${totalAds} ads for competitor ID ${result.competitorId}`)
  }
})

// Add event listener to trim the queue when the data limit exceeds
scrapeQueue.on("completed", async () => {
  const MAX_QUEUE_SIZE = 1000 // Set your desired queue size limit
  const jobCounts = await scrapeQueue.getJobCounts()

  if (jobCounts.waiting + jobCounts.active + jobCounts.completed > MAX_QUEUE_SIZE) {
    console.log("Queue size exceeded. Trimming old jobs...")
    const jobs = await scrapeQueue.getCompleted(0, MAX_QUEUE_SIZE - 1)
    for (const job of jobs) {
      await scrapeQueue.removeJobs(String(job.id)) // Remove old jobs
    }
  }
})

// Add event listener for stalled jobs
scrapeQueue.on("stalled", (job) => {
  console.warn(`Job ${job.id} has stalled and will be reprocessed`)
})

// Add event listener for queue errors
scrapeQueue.on("error", (error) => {
  console.error("Queue error:", error)
})

// Graceful shutdown function
export async function closeQueue() {
  console.log("Closing queue...")
  await scrapeQueue.close()
  console.log("Queue closed")
}

// Handle process termination
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing queue...")
  await closeQueue()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing queue...")
  await closeQueue()
  process.exit(0)
})
