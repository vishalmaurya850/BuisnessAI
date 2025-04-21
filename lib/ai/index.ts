import type { AdType, AdAnalysis, CompetitorData, AdData, BusinessData, CompetitorDiscoveryResult } from "@/lib/types"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { db } from "@/lib/db"
import { competitors, ads, businesses } from "@/lib/db/schema"
import { eq, desc, like } from "drizzle-orm"

export const runtime = "nodejs"; 

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// We'll use a simpler approach for video analysis without FFmpeg
// since it's causing TypeScript issues
export async function analyzeAdContent(content: string, adType: AdType): Promise<AdAnalysis> {
  try {
    // Prepare the prompt based on ad type
    let prompt = ""

    if (adType === "image") {
      prompt = `Analyze this image ad with the following content: "${content}". 
      Provide insights on: 
      1. What is being shown
      2. The emotion/theme
      3. Target audience
      4. Product/service being promoted
      Format the response as JSON with these fields: emotion, targetAudience, product, strategy`
    } else if (adType === "video") {
      prompt = `Analyze this video ad with the following content: "${content}". 
      Provide insights on: 
      1. What is being promoted
      2. Tone and branding
      3. Any offers/calls-to-action
      Format the response as JSON with these fields: promotion, tone, callToAction, strategy`
    } else {
      prompt = `Analyze this text ad: "${content}". 
      Provide insights on: 
      1. The key message
      2. Target audience
      3. Call to action
      Format the response as JSON with these fields: message, targetAudience, callToAction, strategy`
    }

    // Use Gemini to generate analysis
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-pro-exp-03-25" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse the response as JSON
    try {
      return JSON.parse(text) as AdAnalysis
    } catch {
      // If parsing fails, return the raw text
      return { rawAnalysis: text }
    }
  } catch (error) {
    console.error("Error in AI analysis:", error)
    return { rawAnalysis: "Analysis failed" }
  }
}

export async function analyzeImage(imageUrl: string): Promise<AdAnalysis> {
  try {
    // Use Gemini Vision for image analysis
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-pro-exp-03-25" })

    // Fetch the image
    const response = await fetch(imageUrl)
    const imageData = await response.arrayBuffer()

    // Convert to base64
    const base64 = Buffer.from(imageData).toString("base64")

    // Create parts with the image
    const parts = [
      {
        inlineData: {
          data: base64,
          mimeType: "image/jpeg", // Adjust based on actual image type
        },
      },
      {
        text: `Analyze this ad image. Provide insights on:
        1. What is being shown
        2. The emotion/theme
        3. Target audience
        4. Product/service being promoted
        Format the response as JSON with these fields: emotion, targetAudience, product, strategy`,
      },
    ]

    // Generate content
    const result = await model.generateContent({ contents: [{ role: "user", parts }] })
    const response_text = result.response.text()

    // Extract JSON from response
    const jsonMatch = response_text.match(/```json\n([\s\S]*?)\n```/) || response_text.match(/{[\s\S]*?}/)

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]) as AdAnalysis
      } catch {
        return { rawAnalysis: response_text }
      }
    }

    return { rawAnalysis: response_text }
  } catch (error) {
    console.error("Error in Gemini image analysis:", error)
    return { rawAnalysis: "Image analysis failed" }
  }
}

export async function analyzeVideo(videoUrl: string): Promise<AdAnalysis> {
  try {
    // For video analysis, we'll use a simplified approach without FFmpeg
    // We'll analyze the video content directly with AI

    // Use Gemini for video analysis
    const prompt = `Analyze this video ad at URL: ${videoUrl}
    
    Provide insights on:
    1. What is being promoted
    2. Tone and branding
    3. Any offers/calls-to-action
    4. Target audience
    
    Format the response as JSON with these fields: promotion, tone, callToAction, targetAudience, strategy`

    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-pro-exp-03-25" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse the response as JSON
    try {
      return JSON.parse(text) as AdAnalysis
    } catch{
      // If parsing fails, return the raw text
      return {
        rawAnalysis: text,
        promotion: "Video content",
        tone: "Not analyzed",
        callToAction: "Not analyzed",
        targetAudience: "Not analyzed",
      }
    }
  } catch (error) {
    console.error("Error in video analysis:", error)
    return { rawAnalysis: "Video analysis failed: " + (error as Error).message }
  }
}

export async function generateChatResponse(question: string, userId: string): Promise<string> {
  try {
    // 1. Get the user's business
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.userId, userId),
    })

    if (!business) {
      return "I couldn't find your business profile. Please set up your business profile first."
    }

    // 2. Retrieve relevant competitor data based on the question
    let competitorData: CompetitorData[] = []
    let adData: AdData[] = []
    let contextData = ""

    // Check for specific competitor mentions
    const competitorMatch =
      question.match(/competitor\s+([A-Za-z0-9\s]+)/i) || question.match(/from\s+([A-Za-z0-9\s]+)/i)

    if (competitorMatch) {
      const competitorName = competitorMatch[1].trim()

      // Look up the competitor
      const competitor = await db.query.competitors.findFirst({
        where: like(competitors.name, `%${competitorName}%`),
      })

      if (competitor) {
        competitorData = [competitor as unknown as CompetitorData]

        // Get recent ads for this competitor
        adData = (await db.query.ads.findMany({
          where: eq(ads.competitorId, competitor.id),
          orderBy: [desc(ads.firstSeen)],
          limit: 10,
        })) as unknown as AdData[]

        contextData += `Competitor: ${competitor.name}\n`
        contextData += `Industry: ${competitor.industry}\n`
        contextData += `Website: ${competitor.website}\n\n`

        contextData += "Recent ads:\n"
        adData.forEach((ad, i) => {
          contextData += `${i + 1}. ${ad.type} ad on ${ad.platform}\n`
          contextData += `   Content: ${ad.content.substring(0, 100)}${ad.content.length > 100 ? "..." : ""}\n`
          contextData += `   First seen: ${new Date(ad.firstSeen).toLocaleDateString()}\n`
          if (ad.aiAnalysis) {
            contextData += `   Analysis: ${JSON.stringify(ad.aiAnalysis).substring(0, 100)}...\n`
          }
          contextData += "\n"
        })
      }
    } else {
      // Get all competitors for this business
      competitorData = (await db.query.competitors.findMany({
        where: eq(competitors.businessId, business.id),
      })) as unknown as CompetitorData[]

      // Get recent ads across all competitors
      adData = (await db.query.ads.findMany({
        orderBy: [desc(ads.firstSeen)],
        limit: 20,
      })) as unknown as AdData[]

      contextData += `Business: ${business.name}\n`
      contextData += `Industry: ${business.industry}\n\n`

      contextData += "Competitors:\n"
      competitorData.forEach((competitor, i) => {
        contextData += `${i + 1}. ${competitor.name} (${competitor.industry})\n`
      })

      contextData += "\nRecent ad activity:\n"
      adData.forEach((ad, i) => {
        const competitor = competitorData.find((c) => c.id === ad.competitorId)
        contextData += `${i + 1}. ${competitor?.name || "Unknown"}: ${ad.type} ad on ${ad.platform}\n`
        contextData += `   First seen: ${new Date(ad.firstSeen).toLocaleDateString()}\n`
      })
    }

    // 3. Generate a response based on the actual data
    const prompt = `
      You are an AI assistant for a competitor analysis tool. Answer the following question based on this data:
      
      ${contextData}
      
      Question: ${question}
      
      Provide a helpful, concise response based only on the data provided. If the data doesn't contain information to answer the question, say so clearly.
    `

    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-pro-exp-03-25" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return text
  } catch (error) {
    console.error("Error generating chat response:", error)
    return "I'm sorry, I couldn't process your request at this time. There was an error accessing the competitor data."
  }
}

export async function discoverCompetitors(business: BusinessData): Promise<CompetitorDiscoveryResult[]> {
  try {
    // Use AI to identify potential competitors
    const prompt = `
      I need to identify 5-10 potential competitors for a business with the following details:

      Business Name: ${business.name}
      Industry: ${business.industry}
      ${business.location ? `Location: ${business.location}` : ""}
      Keywords: ${business.keywords}
      ${business.knownCompetitors ? `Known Competitors: ${business.knownCompetitors}` : ""}

      For each competitor, provide:
      1. Name
      2. Website URL
      3. Industry/niche

      Format your response ONLY as a valid JSON array of objects, where each object has "name", "website", and "industry" fields. Example: [{"name": "Example Inc", "website": "https://example.com", "industry": "Tech"}]
      Do NOT include any introductory text, backticks, or the word "json". Just the array.
    `;

    const modelName = "models/gemini-1.5-flash-latest";
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Sanitize the AI response
    const sanitizedText = text.replace(/^json\s*/i, "").replace(/```/g, "").trim();

    // Parse the sanitized response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(sanitizedText);
    } catch (error) {
      console.error("Error parsing AI response JSON:", error);
      console.error("Raw text:", sanitizedText);
      throw new Error("Failed to parse AI response");
    }

    // Validate that the parsed response is an array
    if (!Array.isArray(parsedResponse)) {
      throw new Error("AI response is not a valid array");
    }

    return parsedResponse;
  } catch (error) {
    console.error("Error discovering competitors:", error);
    throw error;
  }
}