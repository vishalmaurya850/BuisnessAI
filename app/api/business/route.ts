import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { auth, currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { ensureUserExists } from "@/lib/auth"
import { discoverCompetitorsWithDetails, type BusinessData } from "@/lib/ai"

// Ensure all imports are correctly resolved
if (!db || !businesses || !auth || !currentUser || !eq || !ensureUserExists || !discoverCompetitorsWithDetails) {
  throw new Error("One or more imports are undefined. Please verify the modules.");
}

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure user exists in our database
    await ensureUserExists(userId)

    // Get the user's business
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.userId, userId),
    })

    if (!business) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({ exists: true, business })
  } catch (error) {
    console.error("Error fetching business:", error)
    return NextResponse.json({ error: "Failed to fetch business" }, { status: 500 })
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
    if (!body.businessName || !body.industry || !body.keywords) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get current user details
    const clerkUser = await currentUser()

    // Ensure user exists in our database
    await ensureUserExists(
      userId,
      clerkUser?.emailAddresses[0]?.emailAddress,
      `${clerkUser?.firstName || ""} ${clerkUser?.lastName || ""}`.trim(),
    )

    // Check if user already has a business
    const existingBusiness = await db.query.businesses.findFirst({
      where: eq(businesses.userId, userId),
    })

    if (existingBusiness) {
      return NextResponse.json(
        { error: "User already has a business profile", business: existingBusiness },
        { status: 400 },
      )
    }

    // Create the business
    const [newBusiness] = await db
      .insert(businesses)
      .values({
        userId,
        name: body.businessName,
        industry: body.industry,
        location: body.location || null,
        keywords: body.keywords,
        knownCompetitors: body.knownCompetitors || null,
      })
      .returning()

    // If known competitors were provided, create them
    if (body.knownCompetitors) {
      const competitors = body.knownCompetitors
        .split(",")
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0)

      if (competitors.length > 0) {
        // For each competitor, use AI to get more details
        try {
          const competitorDetails = await discoverCompetitorsWithDetails({
            ...newBusiness,
            knownCompetitors: body.knownCompetitors,
          } as unknown as BusinessData)

          // Map the discovered competitors by name for easy lookup
          const detailsMap = new Map(competitorDetails.map((comp) => [comp.name.toLowerCase(), comp]))

          // Create competitors with details when available
          for (const competitorName of competitors) {
            const details = detailsMap.get(competitorName.toLowerCase()) || {
              name: competitorName,
              website: `https://${competitorName.toLowerCase().replace(/\s+/g, "")}.com`,
              industry: newBusiness.industry,
              description: `A competitor in the ${newBusiness.industry} industry.`,
              products: "Various products and services",
              targetAudience: "Similar to your target audience",
              uniqueSellingProposition: "Unknown",
            }

            await db.insert(competitors).values({
              userId,
              businessId: newBusiness.id,
              name: details.name,
              website: details.website,
              industry: details.industry || newBusiness.industry,
              description: details.description,
              products: details.products,
              targetAudience: details.targetAudience,
              uniqueSellingProposition: details.uniqueSellingProposition,
              trackFacebook: true,
              trackGoogle: true,
              trackInstagram: true,
              trackLinkedIn: false,
            })
          }
        } catch (error) {
          console.error("Error getting competitor details:", error)

          // Fallback to basic competitor creation if AI fails
          for (const competitorName of competitors) {
            await db.insert(competitors).values({
              userId,
              businessId: newBusiness.id,
              name: competitorName,
              website: `https://${competitorName.toLowerCase().replace(/\s+/g, "")}.com`,
              industry: newBusiness.industry,
              trackFacebook: true,
              trackGoogle: true,
              trackInstagram: true,
              trackLinkedIn: false,
            })
          }
        }
      }
    }

    // Trigger the initial competitor discovery process
    // In a real app, this would be a background job
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/competitors/discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: newBusiness.id,
          userId, // Include userId in the request
        }),
      })
    } catch (error) {
      console.error("Error triggering competitor discovery:", error)
      // We don't want to fail the business creation if this fails
    }

    return NextResponse.json(newBusiness, { status: 201 })
  } catch (error) {
    console.error("Error creating business:", error)
    return NextResponse.json({ error: "Failed to create business" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Get the user's business
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.userId, userId),
    })

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    // Update the business
    const [updatedBusiness] = await db
      .update(businesses)
      .set({
        name: body.businessName || business.name,
        industry: body.industry || business.industry,
        location: body.location || business.location,
        keywords: body.keywords || business.keywords,
        knownCompetitors: body.knownCompetitors || business.knownCompetitors,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, business.id))
      .returning()

    return NextResponse.json(updatedBusiness)
  } catch (error) {
    console.error("Error updating business:", error)
    return NextResponse.json({ error: "Failed to update business" }, { status: 500 })
  }
}