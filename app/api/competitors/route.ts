import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { competitors, businesses } from "@/lib/db/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import type { CompetitorData } from "@/lib/types"

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      console.error("Unauthorized: No user ID found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const competitorId = Number(params.id);

    if (isNaN(competitorId)) {
      console.error("Invalid competitor ID:", params.id);
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 });
    }

    // Check if the competitor exists
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    });

    if (!competitor) {
      console.error(`Competitor with ID ${competitorId} not found`);
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    // Get the user's business
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.userId, userId),
    });

    if (!business) {
      console.error(`Business not found for user ID ${userId}`);
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (competitor.businessId !== business.id) {
      console.error(
        `Unauthorized: Competitor ${competitorId} does not belong to business ${business.id}`
      );
      return NextResponse.json({ error: "Unauthorized to delete this competitor" }, { status: 403 });
    }

    // Delete the competitor
    await db.delete(competitors).where(eq(competitors.id, competitorId));

    console.log(`Competitor ${competitorId} deleted successfully`);
    return NextResponse.json({ message: "Competitor deleted successfully" });
  } catch (error) {
    console.error("Error deleting competitor:", error);
    return NextResponse.json({ error: "Failed to delete competitor" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the user's business
    const business = await db.query.businesses.findFirst({
      where: userId ? eq(businesses.userId, userId) : undefined,
    })

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    // Get competitors for this business
    const allCompetitors = await db.query.competitors.findMany({
      where: eq(competitors.businessId, business.id),
    })

    return NextResponse.json(allCompetitors as CompetitorData[])
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

    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.website || !body.industry) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get the user's business
    const business = await db.query.businesses.findFirst({
      where: userId ? eq(businesses.userId, userId) : undefined,
    })

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    const newCompetitor = await db
      .insert(competitors)
      .values({
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