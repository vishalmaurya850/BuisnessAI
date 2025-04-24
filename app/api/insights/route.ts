import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db/connection"
import { ads, competitors, insights } from "@/lib/db/schema"
import { desc, eq, and, sql } from "drizzle-orm"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { ensureUserExists, getUserBusinessId } from "@/lib/auth"

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function GET(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get("limit") || "10")
    const offset = Number.parseInt(url.searchParams.get("offset") || "0")

    const database = await getDb()

    // Filter by user ID
    const insightResults = await database
      .select()
      .from(insights)
      .where(eq(insights.userId, userId))
      .orderBy(desc(insights.createdAt))
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    const [{ count }] = await database
      .select({ count: sql<number>`COUNT(*)` })
      .from(insights)
      .where(eq(insights.userId, userId))

    return NextResponse.json({
      insights: insightResults,
      total: Number(count),
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching insights:", error)
    return NextResponse.json({ error: "Failed to fetch insights" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in our database
    await ensureUserExists(userId);

    const body = await request.json();

    // Get the user's business ID
    const businessId = await getUserBusinessId(userId);

    if (!businessId) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const database = await getDb();

    // Check if we need to generate an insight
    if (body.generate) {
      // Get recent ads to analyze
      const recentAds = await database
        .select()
        .from(ads)
        .where(eq(ads.userId, userId))
        .orderBy(desc(ads.firstSeen))
        .limit(50);

      // Get competitor information
      const competitorInfo = await database
        .select()
        .from(competitors)
        .where(eq(competitors.userId, userId));

      // Prepare data for AI analysis
      const adSummary = recentAds.map((ad: { competitorId: number; platform: string; type: string; content: string; firstSeen: Date }) => ({
        competitorName: competitorInfo.find((c: { id: number; name: string }) => c.id === ad.competitorId)?.name || "Unknown",
        platform: ad.platform,
        type: ad.type,
        content: ad.content.substring(0, 100),
        firstSeen: ad.firstSeen.toISOString(), // Convert Date to ISO string
      }));

      // Generate insight using AI
      const prompt = `
        Based on the following recent competitor ad data, generate a strategic insight and recommendation:
        
        ${JSON.stringify(adSummary, null, 2)}
        
        Format your response as JSON with these fields:
        - title: A concise title for the insight
        - description: A detailed explanation of the insight
        - recommendation: A specific, actionable recommendation based on the insight
      `;

      // Use Gemini for insight generation
      const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash-exp-0827" });
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Parse the AI response
      let aiResponse;
      try {
        // Extract JSON from response if it's wrapped in code blocks
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*?}/);
        if (jsonMatch) {
          aiResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
          aiResponse = JSON.parse(text);
        }
      } catch (e) {
        console.error("Error parsing AI response:", e);
        console.error("Raw AI response:", text);

        // If parsing fails, create a generic insight
        aiResponse = {
          title: "New Competitor Activity Detected",
          description: "There has been new activity from your competitors recently.",
          recommendation: "Review the latest ads to identify trends and opportunities.",
        };
      }

      // Create the insight
      const newInsight = await database
        .insert(insights)
        .values({
          userId, // Add user ID to link directly to the user
          businessId,
          title: aiResponse.title,
          description: aiResponse.description,
          recommendation: aiResponse.recommendation,
        })
        .returning();

      return NextResponse.json(newInsight[0], { status: 201 });
    } else {
      // Manual insight creation
      if (!body.title || !body.description || !body.recommendation) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const newInsight = await database
        .insert(insights)
        .values({
          userId, // Add user ID to link directly to the user
          businessId,
          title: body.title,
          description: body.description,
          recommendation: body.recommendation,
          isApplied: body.isApplied || false,
        })
        .returning();

      return NextResponse.json(newInsight[0], { status: 201 });
    }
  } catch (error) {
    console.error("Error creating insight:", error);
    return NextResponse.json({ error: "Failed to create insight" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.id) {
      return NextResponse.json({ error: "Missing insight ID" }, { status: 400 })
    }

    const updateData: Partial<{ isApplied: boolean }> = {}

    if (body.isApplied !== undefined) {
      updateData.isApplied = body.isApplied
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const database = await getDb()

    // Update the insight, ensuring it belongs to the user
    const updatedInsight = await database
      .update(insights)
      .set(updateData)
      .where(and(eq(insights.id, body.id), eq(insights.userId, userId)))
      .returning()

    if (updatedInsight.length === 0) {
      return NextResponse.json({ error: "Insight not found or not owned by user" }, { status: 404 })
    }

    return NextResponse.json(updatedInsight[0])
  } catch (error) {
    console.error("Error updating insight:", error)
    return NextResponse.json({ error: "Failed to update insight" }, { status: 500 })
  }
}
