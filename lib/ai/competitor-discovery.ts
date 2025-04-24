import { GoogleGenerativeAI } from "@google/generative-ai"
import type { BusinessData, CompetitorDiscoveryResult } from "@/lib/types"

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

/**
 * Uses AI to discover competitors and get detailed information about them
 */
export async function discoverCompetitorsWithDetails(business: BusinessData): Promise<CompetitorDiscoveryResult[]> {
  try {
    // Use AI to identify potential competitors with detailed information
    const prompt = `
      I need to identify 5-10 potential competitors for a business with the following details:
      
      Business Name: ${business.name}
      Industry: ${business.industry}
      ${business.location ? `Location: ${business.location}` : ""}
      Keywords: ${business.keywords}
      ${business.knownCompetitors ? `Known Competitors: ${business.knownCompetitors}` : ""}
      
      For each competitor, provide:
      1. Name
      2. Website URL (a real, valid URL)
      3. Industry/niche
      4. A brief description (2-3 sentences about what they do)
      5. Key products or services
      6. Target audience
      7. Unique selling proposition
      
      Format your response as JSON with an array of competitors, each with name, website, industry, description, products, targetAudience, and uniqueSellingProposition fields.
      Only include real, well-known companies that are actual competitors in this space.
      Ensure all website URLs are valid and include https:// prefix.
      
      The response should be in this format:
      {
        "competitors": [
          {
            "name": "Competitor Name",
            "website": "https://example.com",
            "industry": "Industry",
            "description": "Description",
            "products": "Products",
            "targetAudience": "Target Audience",
            "uniqueSellingProposition": "USP"
          }
        ]
      }
    `

    // Use Gemini for competitor discovery
    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash-8b-latest" })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Parse the AI response
    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*?}/)
      let jsonText = ""

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0]
      } else {
        jsonText = text
      }

      // Try to parse the JSON
      let competitorsList
      try {
        competitorsList = JSON.parse(jsonText)
      } catch (parseError) {
        // If parsing fails, try to clean up the JSON
        const cleanedJson = jsonText
          .replace(/[\n\r\t]/g, "")
          .replace(/\s+/g, "")
          .trim()
        competitorsList = JSON.parse(cleanedJson)
      }

      // Handle different response formats
      let competitors = []
      if (competitorsList.competitors) {
        competitors = competitorsList.competitors
      } else if (Array.isArray(competitorsList)) {
        competitors = competitorsList
      } else {
        // If we can't find a valid array, create a default competitor
        competitors = [
          {
            name: `Competitor in ${business.industry}`,
            website: `https://example.com`,
            industry: business.industry,
            description: `A competitor in the ${business.industry} industry.`,
            products: "Various products and services",
            targetAudience: "Similar to your target audience",
            uniqueSellingProposition: "Unknown",
          },
        ]
      }

      // Validate and clean up the data
      const validatedCompetitors = competitors.map((competitor: Partial<CompetitorDiscoveryResult>) => {
        // Ensure website has https:// prefix
        let website = competitor.website || ""
        if (website && !website.startsWith("http://") && !website.startsWith("https://")) {
          website = "https://" + website
        }

        return {
          name: competitor.name || `Competitor in ${business.industry}`,
          website,
          industry: competitor.industry || business.industry,
          description:
            competitor.description || `A competitor in the ${competitor.industry || business.industry} industry.`,
          products: competitor.products || "Various products and services",
          targetAudience: competitor.targetAudience || "Similar to your target audience",
          uniqueSellingProposition: competitor.uniqueSellingProposition || "Unknown",
        }
      })

      return validatedCompetitors
    } catch (e) {
      console.error("Error parsing AI response:", e)
      // Return a default competitor instead of throwing an error
      return [
        {
          name: `Competitor in ${business.industry}`,
          website: `https://example.com`,
          industry: business.industry,
          description: `A competitor in the ${business.industry} industry.`,
          products: "Various products and services",
          targetAudience: "Similar to your target audience",
          uniqueSellingProposition: "Unknown",
        },
      ]
    }
  } catch (error) {
    console.error("Error discovering competitors:", error)
    // Return a default competitor instead of throwing an error
    return [
      {
        name: `Competitor in ${business.industry}`,
        website: `https://example.com`,
        industry: business.industry,
        description: `A competitor in the ${business.industry} industry.`,
        products: "Various products and services",
        targetAudience: "Similar to your target audience",
        uniqueSellingProposition: "Unknown",
      },
    ]
  }
}