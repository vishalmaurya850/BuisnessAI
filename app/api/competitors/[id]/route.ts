import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { competitors, ads, alerts } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// GET endpoint to retrieve a specific competitor
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params;
    const competitorId = Number.parseInt(id);

    if (isNaN(competitorId)) {
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 })
    }

    // Get competitor details - ensure it belongs to the current user
    const competitor = await db.query.competitors.findFirst({
      where: and(eq(competitors.id, competitorId), eq(competitors.userId, userId)),
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    return NextResponse.json(competitor)
  } catch (error) {
    console.error(`Error fetching competitor ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to fetch competitor" }, { status: 500 })
  }
}

// PATCH endpoint to update a competitor
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params;
    const competitorId = Number.parseInt(id);

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

    const body = await request.json()

    // Update the competitor
    const [updatedCompetitor] = await db
      .update(competitors)
      .set({
        name: body.name || competitor.name,
        website: body.website || competitor.website,
        industry: body.industry || competitor.industry,
        notes: body.notes !== undefined ? body.notes : competitor.notes,
        trackFacebook: body.trackFacebook !== undefined ? body.trackFacebook : competitor.trackFacebook,
        trackGoogle: body.trackGoogle !== undefined ? body.trackGoogle : competitor.trackGoogle,
        trackInstagram: body.trackInstagram !== undefined ? body.trackInstagram : competitor.trackInstagram,
        trackLinkedIn: body.trackLinkedIn !== undefined ? body.trackLinkedIn : competitor.trackLinkedIn,
        updatedAt: new Date(),
      })
      .where(and(eq(competitors.id, competitorId), eq(competitors.userId, userId)))
      .returning()

    return NextResponse.json(updatedCompetitor)
  } catch (error) {
    console.error(`Error updating competitor ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to update competitor" }, { status: 500 })
  }
}

// DELETE endpoint to delete a competitor
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params;
    const competitorId = Number.parseInt(id);

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

    // Delete related data first (cascade delete)
    // 1. Delete ads
    await db.delete(ads).where(and(eq(ads.competitorId, competitorId), eq(ads.userId, userId)))

    // 2. Delete alerts
    await db.delete(alerts).where(and(eq(alerts.competitorId, competitorId), eq(alerts.userId, userId)))

    // 3. Delete the competitor
    await db.delete(competitors).where(and(eq(competitors.id, competitorId), eq(competitors.userId, userId)))

    return NextResponse.json({ success: true, message: "Competitor deleted successfully" })
  } catch (error) {
    console.error(`Error deleting competitor ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to delete competitor" }, { status: 500 })
  }
}