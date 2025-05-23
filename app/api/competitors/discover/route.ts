import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { businesses, competitors } from "@/lib/db/schema"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { discoverCompetitorsWithDetails } from "@/lib/ai"
import type { BusinessData, DiscoveryResponse } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the user's business
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.userId, userId),
    })

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    // Use AI to identify potential competitors with detailed information
    const discoveredCompetitors = await discoverCompetitorsWithDetails(business as unknown as BusinessData)

    // Add the competitors to the database
    const newCompetitors = []

    for (const comp of discoveredCompetitors) {
      // Check if this competitor already exists
      const existingCompetitor = await db.query.competitors.findFirst({
        where: eq(competitors.name, comp.name),
      })

      if (!existingCompetitor) {
        const [newCompetitor] = await db
          .insert(competitors)
          .values({
            businessId: business.id,
            userId, // Add user ID to link directly to the user
            name: comp.name,
            website: comp.website,
            industry: comp.industry,
            description: comp.description,
            products: comp.products,
            targetAudience: comp.targetAudience,
            uniqueSellingProposition: comp.uniqueSellingProposition,
            trackFacebook: true,
            trackGoogle: true,
            trackInstagram: true,
            trackLinkedIn: false,
          })
          .returning()

        newCompetitors.push(newCompetitor)
      }
    }

    // Trigger initial scraping for each new competitor
    for (const competitor of newCompetitors) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/competitors/${competitor.id}/scrape`,
          {
            method: "POST",
          },
        )
      } catch (error) {
        console.error(`Error triggering scrape for competitor ${competitor.id}:`, error)
        // We don't want to fail the whole process if one scrape fails
      }
    }

    const response: DiscoveryResponse = {
      success: true,
      newCompetitors: newCompetitors as any,
      total: newCompetitors.length,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error discovering competitors:", error)
    return NextResponse.json({ error: "Failed to discover competitors" }, { status: 500 })
  }
}
