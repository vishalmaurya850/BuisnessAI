import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { businesses, users } from "@/lib/db/schema"
import { auth, currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { GoogleGenerativeAI } from "@google/generative-ai"

export const runtime = "nodejs";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure user exists in our database
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!user) {
      // Create user if they don't exist (this can happen if the webhook fails)
      const clerkUser = await currentUser()

      if (!clerkUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      await db.insert(users).values({
        id: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
      })
    }

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
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.businessName || !body.industry || !body.keywords) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user already has a business
    const existingBusiness = await db.query.businesses.findFirst({
      where: eq(businesses.userId, userId),
    });

    if (existingBusiness) {
      return NextResponse.json(
        { error: "User already has a business profile", business: existingBusiness },
        { status: 400 }
      );
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
      .returning();

    // If known competitors were provided, create them with AI-enhanced details
    if (body.knownCompetitors) {
      const competitors = body.knownCompetitors
        .split(",")
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0);

      if (competitors.length > 0) {
        for (const competitorName of competitors) {
          try {
            // Use AI to fetch additional details about the competitor
            const prompt = `Provide detailed information about the competitor "${competitorName}" in the ${body.industry} industry. Include their website, industry, and any relevant details.`;
            const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro" });
            const result = await model.generateContent(prompt);
            const aiResponse = result.response.text();

            // Parse AI response (assuming it returns JSON-like data)
            const competitorDetails = JSON.parse(aiResponse);

            await db.insert(competitors).values({
              businessId: newBusiness.id,
              name: competitorName,
              website: competitorDetails.website || `https://${competitorName.toLowerCase().replace(/\s+/g, "")}.com`,
              industry: competitorDetails.industry || body.industry,
              trackFacebook: true,
              trackGoogle: true,
              trackInstagram: true,
              trackLinkedIn: false,
            });
          } catch (error) {
            console.error(`Error fetching AI details for competitor "${competitorName}":`, error);
            // Fallback to creating a basic competitor entry
            await db.insert(competitors).values({
              businessId: newBusiness.id,
              name: competitorName,
              website: `https://${competitorName.toLowerCase().replace(/\s+/g, "")}.com`, // Placeholder
              industry: body.industry,
              trackFacebook: true,
              trackGoogle: true,
              trackInstagram: true,
              trackLinkedIn: false,
            });
          }
        }
      }
    }

    // Trigger the initial competitor discovery process
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/competitors/discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: newBusiness.id,
        }),
      });
    } catch (error) {
      console.error("Error triggering competitor discovery:", error);
      // We don't want to fail the business creation if this fails
    }

    return NextResponse.json(newBusiness, { status: 201 });
  } catch (error) {
    console.error("Error creating business:", error);
    return NextResponse.json({ error: "Failed to create business" }, { status: 500 });
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