import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { scrapeCompetitor } from "@/lib/scraper"
import { db } from "@/lib/db"
import { competitors } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const competitorId = Number.parseInt(params.id)

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

    // Start the scraping process
    const results = await scrapeCompetitor(competitorId)

    return NextResponse.json(results)
  } catch (error) {
    console.error(`Error scraping competitor ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to scrape competitor data" }, { status: 500 })
  }
}
