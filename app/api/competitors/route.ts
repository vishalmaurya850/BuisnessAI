import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { competitors, businesses } from "@/lib/db/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { ensureUserExists } from "@/lib/auth"
import type { CompetitorData } from "@/lib/types"

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure user exists in our database
    await ensureUserExists(userId)

    // Get competitors for this user
    const userCompetitors = await db.query.competitors.findMany({
      where: eq(competitors.userId, userId),
    })

    return NextResponse.json(userCompetitors as CompetitorData[])
  } catch (error) {
    console.error("Error fetching competitors:", error)
    return NextResponse.json({ error: "Failed to fetch competitors" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure user exists in our database
    await ensureUserExists(userId)

    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.website || !body.industry) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get the user's business
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.userId, userId),
    })

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    const newCompetitor = await db
      .insert(competitors)
      .values({
        userId, // Add user ID to link directly to the user
        businessId: business.id,
        name: body.name,
        website: body.website,
        industry: body.industry,
        notes: body.notes,
        trackFacebook: body.trackFacebook ?? true,
        trackGoogle: body.trackGoogle ?? true,
        trackInstagram: body.trackInstagram ?? true,
        trackLinkedIn: body.trackLinkedIn ?? false,
      })
      .returning()

    return NextResponse.json(newCompetitor[0], { status: 201 })
  } catch (error) {
    console.error("Error creating competitor:", error)
    return NextResponse.json({ error: "Failed to create competitor" }, { status: 500 })
  }
}