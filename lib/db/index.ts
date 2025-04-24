import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"
import { createDbConnection } from "./connection"

// Use environment variables for database connection in production
const connectionString = process.env.DATABASE_URL || ""

// Initialize postgres client
const client = postgres(connectionString)

// Initialize drizzle with the client and schema
export const db = drizzle(client, { schema })

// Export the createDbConnection function for use in middleware
export { createDbConnection }