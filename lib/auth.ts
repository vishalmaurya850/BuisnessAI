import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db/connection"
import { users, competitors, businesses, ads } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Gets the current user ID from Clerk authentication
 * Throws an error if user is not authenticated
 */
export async function getCurrentUserId(): Promise<string> {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("User not authenticated")
  }

  return userId
}

/**
 * Ensures the user exists in our database
 * Creates the user if they don't exist
 */
export async function ensureUserExists(userId: string, email?: string, name?: string): Promise<void> {
  try {
    const database = await getDb()

    // Check if user exists
    const existingUser = await database.select().from(users).where(eq(users.id, userId)).then(rows => rows[0])

    if (!existingUser) {
      console.log(
        `Creating new user with ID: ${userId}, email: ${email || "not provided"}, name: ${name || "not provided"}`,
      )

      // Create user if they don't exist
      await database.insert(users).values({
        id: userId,
        email: email || "",
        name: name || "",
      })

      console.log(`User ${userId} created successfully`)
    } else {
      // Update user if email or name has changed
      if ((email && existingUser.email !== email) || (name && existingUser.name !== name)) {
        console.log(`Updating user ${userId} with new information`)
        await database
          .update(users)
          .set({
            email: email || existingUser.email,
            name: name || existingUser.name,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
      }
    }
  } catch (error) {
    console.error(`Error ensuring user exists: ${error instanceof Error ? error.message : "Unknown error"}`)
    // Don't throw here, just log the error to prevent breaking the application flow
  }
}

/**
 * Gets the business ID for the current user
 * Returns null if no business exists
 */
export async function getUserBusinessId(userId: string): Promise<number | null> {
  const database = await getDb()
  const business = await database.select().from(businesses).where(eq(businesses.userId, userId)).then(rows => rows[0]);

  return business?.id || null
}

/**
 * Checks if a competitor belongs to the current user
 */
export async function isCompetitorOwnedByUser(competitorId: number, userId: string): Promise<boolean> {
  const database = await getDb()
  const competitor = await database
    .select()
    .from(competitors)
    .where(eq(competitors.id, competitorId))
  .then(rows => rows[0]);

  return competitor?.userId === userId
}

/**
 * Checks if an ad belongs to the current user
 */
export async function isAdOwnedByUser(adId: number, userId: string): Promise<boolean> {
  const database = await getDb()
  const ad = await database
    .select()
    .from(ads)
    .where(eq(ads.id, adId))
    .then(rows => rows[0]);

  return ad?.userId === userId;
}