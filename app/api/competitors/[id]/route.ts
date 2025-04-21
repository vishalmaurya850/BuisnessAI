import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { competitors, ads, alerts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// GET endpoint to retrieve a specific competitor
export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await context.params; // Await params
    const competitorId = Number.parseInt(params.id);

    if (isNaN(competitorId)) {
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 })
    }

    // Get competitor details
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    return NextResponse.json(competitor)
  } catch (error) {
    console.error(`Error fetching competitor ${context.params.id}:`, error)
    return NextResponse.json({ error: "Failed to fetch competitor" }, { status: 500 })
  }
}

// PATCH endpoint to update a competitor
export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await context.params; // Await params
    const competitorId = Number.parseInt(params.id);

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
      .where(eq(competitors.id, competitorId))
      .returning()

    return NextResponse.json(updatedCompetitor)
  } catch (error) {
    console.error(`Error updating competitor ${context.params.id}:`, error)
    return NextResponse.json({ error: "Failed to update competitor" }, { status: 500 })
  }
}

// DELETE endpoint to delete a competitor
export async function DELETE(request: Request, context: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = await context.params; // Await params
    const competitorId = Number.parseInt(params.id);

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

    // Delete related data first (cascade delete)
    // 1. Delete ads
    await db.delete(ads).where(eq(ads.competitorId, competitorId))

    // 2. Delete alerts
    await db.delete(alerts).where(eq(alerts.competitorId, competitorId))

    // 3. Delete the competitor
    await db.delete(competitors).where(eq(competitors.id, competitorId))

    return NextResponse.json({ success: true, message: "Competitor deleted successfully" })
  } catch (error) {
    console.error(`Error deleting competitor ${context.params.id}:`, error)
    return NextResponse.json({ error: "Failed to delete competitor" }, { status: 500 })
  }
}
