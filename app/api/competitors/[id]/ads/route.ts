import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { ads, competitors } from "@/lib/db/schema"
import { eq, desc, sql, and } from "drizzle-orm"

export const runtime = "nodejs";

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

    // Check if competitor exists
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
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

    // Build query
    const query = db.query.ads.findMany({
      where: (ads, { and, eq }) => {
        const conditions = [eq(ads.competitorId, competitorId)]

        if (platform) {
          conditions.push(eq(ads.platform, platform as "facebook" | "google" | "instagram" | "linkedin" | "twitter" | "tiktok" | "other"))
        }

        if (type) {
          conditions.push(eq(ads.type, type as "other" | "image" | "video" | "text" | "carousel"))
        }

        if (activeOnly) {
          conditions.push(eq(ads.isActive, true))
        }

        return and(...conditions)
      },
      orderBy: [desc(ads.firstSeen)],
      limit,
      offset,
    })

    const adResults = await query

    // Get total count for pagination
    const countQuery = db
      .select({ count: sql`COUNT(*)` })
      .from(ads)
      .where(() => {
        const conditions = [eq(ads.competitorId, competitorId)];

        if (platform) {
          conditions.push(eq(ads.platform, platform as "facebook" | "google" | "instagram" | "linkedin" | "twitter" | "tiktok" | "other"));
        }

        if (type) {
          conditions.push(eq(ads.type, type as "other" | "image" | "video" | "text" | "carousel"));
        }

        if (activeOnly) {
          conditions.push(eq(ads.isActive, true));
        }

        return and(...conditions);
      });

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
