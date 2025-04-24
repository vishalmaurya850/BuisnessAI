import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { ads, competitors } from "@/lib/db/schema"
import { eq, desc, and, sql } from "drizzle-orm"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const competitorId = Number.parseInt(params.id)

    if (isNaN(competitorId)) {
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 })
    }

    // Check if competitor exists and belongs to the current user
    const competitor = await db.query.competitors.findFirst({
      where: and(eq(competitors.id, competitorId), eq(competitors.userId, userId)),
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    const url = new URL(request.url)
    const platform = url.searchParams.get("platform")
    const type = url.searchParams.get("type")
    const limit = Number.parseInt(url.searchParams.get("limit") || "50")
    const offset = Number.parseInt(url.searchParams.get("offset") || "0")
    const activeOnly = url.searchParams.get("active") === "true"

    // Build query conditions with user ID filter
    let whereCondition = and(eq(ads.competitorId, competitorId), eq(ads.userId, userId))

    if (platform) {
      const validPlatforms = ["facebook", "google", "instagram", "linkedin", "twitter", "tiktok", "other"] as const
      if (validPlatforms.includes(platform as typeof validPlatforms[number])) {
        whereCondition = and(whereCondition, eq(ads.platform, platform as typeof validPlatforms[number]))
      }
    }

    if (type) {
      whereCondition = and(whereCondition, eq(ads.type, type as "other" | "image" | "video" | "text" | "carousel"))
    }

    if (activeOnly) {
      whereCondition = and(whereCondition, eq(ads.isActive, true))
    }

    // Build the query with ordering, limit, and offset
    const query = db.query.ads.findMany({
      where: whereCondition,
      orderBy: desc(ads.firstSeen),
      limit,
      offset,
    })

    const adResults = await query

    // Get total count for pagination
    const countConditions = and(
      eq(ads.competitorId, competitorId),
      eq(ads.userId, userId),
      platform ? eq(ads.platform, platform as "facebook" | "google" | "instagram" | "linkedin" | "twitter" | "tiktok" | "other") : undefined,
      type ? eq(ads.type, type as "other" | "image" | "video" | "text" | "carousel") : undefined,
      activeOnly ? eq(ads.isActive, true) : undefined
    )
    
    const countQuery = db
      .select({ count: sql`COUNT(*)` })
      .from(ads)
      .where(countConditions)

    const [{ count }] = await countQuery

    return NextResponse.json({
      competitor: {
        id: competitor.id,
        name: competitor.name,
      },
      ads: adResults,
      total: Number(count),
      limit,
      offset,
    })
  } catch (error) {
    console.error(`Error fetching ads for competitor ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to fetch competitor ads" }, { status: 500 })
  }
}