import { db } from "@/lib/db"
import { ads } from "@/lib/db/schema"
import { eq, and, count } from "drizzle-orm"

/**
 * Gets the count of active ads for a competitor
 */
export async function getActiveAdsCount(competitorId: number, userId: string): Promise<number> {
  try {
    // Ensure competitorId is a valid number
    if (isNaN(competitorId) || competitorId <= 0) {
      console.error(`Invalid competitorId: ${competitorId}`)
      return 0
    }

    const [result] = await db
      .select({ count: count() })
      .from(ads)
      .where(and(eq(ads.competitorId, competitorId), eq(ads.userId, userId), eq(ads.isActive, true)))

    return Number(result.count) || 0
  } catch (error) {
    console.error(`Error getting active ads count for competitor ${competitorId}:`, error)
    return 0
  }
}

/**
 * Gets the count of active ads for multiple competitors
 * Returns a map of competitorId -> count
 */
export async function getActiveAdsCountForCompetitors(
  competitorIds: number[],
  userId: string,
): Promise<Map<number, number>> {
  try {
    if (competitorIds.length === 0) {
      return new Map()
    }

    // Filter out invalid competitorIds
    const validCompetitorIds = competitorIds.filter((id) => !isNaN(id) && id > 0)

    if (validCompetitorIds.length === 0) {
      return new Map()
    }

    const results = await db
      .select({ competitorId: ads.competitorId, count: count() })
      .from(ads)
      .where(and(eq(ads.isActive, true), eq(ads.userId, userId)))
      .groupBy(ads.competitorId)

    // Create a map of competitorId -> count
    const countsMap = new Map<number, number>()

    // Initialize all requested competitor IDs with 0
    validCompetitorIds.forEach((id) => countsMap.set(id, 0))

    // Update with actual counts
    results.forEach((result) => {
      countsMap.set(result.competitorId, Number(result.count))
    })

    return countsMap
  } catch (error) {
    console.error("Error getting active ads counts for competitors:", error)
    // Return a map with 0 counts for all requested competitors
    return new Map(competitorIds.filter((id) => !isNaN(id) && id > 0).map((id) => [id, 0]))
  }
}