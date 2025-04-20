import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { insights, ads, competitors } from "@/lib/db/schema"
import { desc, eq, and, gte } from "drizzle-orm"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { InsightData } from "@/lib/types"

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Handle GET request to fetch insights
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = Number(url.searchParams.get("businessId"));
    const limit = Number(url.searchParams.get("limit") || "10");
    const offset = Number(url.searchParams.get("offset") || "0");

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId parameter" }, { status: 400 });
    }

    const insightsData: InsightData[] = await db.query.insights.findMany({
      where: eq(insights.businessId, businessId),
      orderBy: [desc(insights.createdAt)],
      limit,
      offset,
    });

    return NextResponse.json(insightsData);
  } catch (error) {
    console.error("Error fetching insights:", error);
    return NextResponse.json({ error: "Failed to fetch insights" }, { status: 500 });
  }
}

// Handle POST request to generate a new insight
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId;

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId in request body" }, { status: 400 });
    }

    // Get competitors for this business
    const businessCompetitors = await db.query.competitors.findMany({
      where: eq(competitors.businessId, businessId),
    });

    if (businessCompetitors.length === 0) {
      return NextResponse.json({ error: "No competitors found for this business" }, { status: 404 });
    }

    const competitorIds = businessCompetitors.map((c) => c.id);

    // Get recent ads from the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentAds = await db.query.ads.findMany({
      where: and(eq(ads.isActive, true), gte(ads.firstSeen, oneWeekAgo)),
      orderBy: [desc(ads.firstSeen)],
      limit: 50,
    });

    // Filter ads for this business's competitors
    const relevantAds = recentAds.filter((ad) => competitorIds.includes(ad.competitorId));

    if (relevantAds.length === 0) {
      return NextResponse.json({ error: "No recent ads found for this business" }, { status: 404 });
    }

    // Prepare data for AI analysis
    const adSummary = relevantAds.map((ad) => {
      const competitor = businessCompetitors.find((c) => c.id === ad.competitorId);

      return {
        competitorName: competitor?.name || "Unknown",
        platform: ad.platform,
        type: ad.type,
        content: ad.content.substring(0, 100) + (ad.content.length > 100 ? "..." : ""),
        firstSeen: ad.firstSeen,
        aiAnalysis: ad.aiAnalysis,
      };
    });

    // Group ads by competitor
    const adsByCompetitor: Record<string, typeof adSummary> = {};
    adSummary.forEach((ad) => {
      if (!adsByCompetitor[ad.competitorName]) {
        adsByCompetitor[ad.competitorName] = [];
      }
      adsByCompetitor[ad.competitorName].push(ad);
    });

    // Generate insight using Google Generative AI
    const prompt = `
      Based on the following recent competitor ad data, generate a strategic insight and recommendation:
      
      ${JSON.stringify(adsByCompetitor, null, 2)}
      
      Format your response as JSON with these fields:
      - title: A concise title for the insight (max 80 characters)
      - description: A detailed explanation of the insight (max 300 characters)
      - recommendation: A specific, actionable recommendation based on the insight (max 200 characters)
    `;

    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-pro-exp-03-25" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse the AI response
    let aiResponse: InsightData;

    try {
      aiResponse = JSON.parse(text) as InsightData;
    } catch (e) {
      console.error("Error parsing AI response:", e);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Create the insight
    const [newInsight] = await db
      .insert(insights)
      .values({
        businessId,
        title: aiResponse.title,
        description: aiResponse.description,
        recommendation: aiResponse.recommendation,
      })
      .returning();

    return NextResponse.json(newInsight as InsightData, { status: 201 });
  } catch (error) {
    console.error("Error generating insight:", error);
    return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
  }
}