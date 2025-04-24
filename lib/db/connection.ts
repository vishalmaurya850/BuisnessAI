import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "./schema"

// Maximum number of retries for database connection
const MAX_RETRIES = 5
// Initial delay in milliseconds
const INITIAL_RETRY_DELAY = 1000
// Maximum delay in milliseconds
const MAX_RETRY_DELAY = 10000

/**
 * Creates a database connection with retry logic
 */
export async function createDbConnection() {
  let retries = 0
  let delay = INITIAL_RETRY_DELAY

  while (retries < MAX_RETRIES) {
    try {
      console.log(`Attempting database connection (attempt ${retries + 1}/${MAX_RETRIES})...`)

      // Get connection string from environment variables
      const connectionString = process.env.DATABASE_URL

      if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is not set")
      }

      // Initialize postgres client
      const client = postgres(connectionString, {
        connect_timeout: 10, // 10 seconds
        idle_timeout: 20, // 20 seconds
        max_lifetime: 60 * 30, // 30 minutes
      })

      // Test the connection
      await client`SELECT 1`

      console.log("Database connection successful")

      // Initialize drizzle with the client and schema
      return drizzle(client, { schema })
    } catch (error) {
      retries++
      console.error(`Database connection failed (attempt ${retries}/${MAX_RETRIES}):`, error)

      if (retries >= MAX_RETRIES) {
        console.error("Maximum retries reached. Could not connect to database.")
        throw error
      }

      // Add jitter to avoid thundering herd problem
      const jitter = Math.random() * 0.3 * delay
      const actualDelay = delay + jitter

      console.log(`Retrying in ${Math.round(actualDelay / 1000)} seconds...`)

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, actualDelay))

      // Exponential backoff
      delay = Math.min(delay * 2, MAX_RETRY_DELAY)
    }
  }

  throw new Error("Failed to connect to database after maximum retries")
}

// Singleton pattern for database connection
let dbInstance: ReturnType<typeof drizzle> | null = null

export async function getDb() {
  if (!dbInstance) {
    dbInstance = await createDbConnection()
  }
  return dbInstance
}