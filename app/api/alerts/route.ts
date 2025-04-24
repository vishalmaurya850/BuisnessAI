import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { alerts, competitors } from "@/lib/db/schema"
import { desc, eq, and, sql } from "drizzle-orm"

export async function GET(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get("limit") || "10")
    const offset = Number.parseInt(url.searchParams.get("offset") || "0")
    const unreadOnly = url.searchParams.get("unread") === "true"
    const importantOnly = url.searchParams.get("important") === "true"

    // Filter by user ID
    const query = db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.createdAt))
      .limit(limit)
      .offset(offset)

    const alertResults = await query

    // Get total count for pagination
    let countQuery = db.select({ count: sql`COUNT(*)` }).from(alerts).where(eq(alerts.userId, userId))

    if (unreadOnly) {
      countQuery = db.select({ count: sql`COUNT(*)` }).from(alerts).where(and(eq(alerts.userId, userId), eq(alerts.isRead, false)))
    }

    if (importantOnly) {
      countQuery = db.select({ count: sql`COUNT(*)` }).from(alerts).where(and(eq(alerts.userId, userId), eq(alerts.isImportant, true)))
    }

    const [{ count }] = await countQuery

    return NextResponse.json({
      alerts: alertResults,
      total: Number(count),
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching alerts:", error)
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 })
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
    if (!body.competitorId || !body.type || !body.title || !body.description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify the competitor belongs to the user
    const competitor = await db.query.competitors.findFirst({
      where: and(eq(competitors.id, body.competitorId), eq(competitors.userId, userId)),
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found or not owned by user" }, { status: 404 })
    }

    // Get the business ID from the competitor
    const businessId = competitor.businessId

    const newAlert = await db
      .insert(alerts)
      .values({
        userId, // Add user ID to link directly to the user
        businessId,
        competitorId: body.competitorId,
        type: body.type,
        title: body.title,
        description: body.description,
        isImportant: body.isImportant || false,
      })
      .returning()

    return NextResponse.json(newAlert[0], { status: 201 })
  } catch (error) {
    console.error("Error creating alert:", error)
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 })
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
      return NextResponse.json({ error: "Missing alert ID" }, { status: 400 })
    }

    const updateData: Partial<{ isRead: boolean; isImportant: boolean }> = {}

    if (body.isRead !== undefined) {
      updateData.isRead = body.isRead
    }

    if (body.isImportant !== undefined) {
      updateData.isImportant = body.isImportant
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Update the alert, ensuring it belongs to the user
    const updatedAlert = await db
      .update(alerts)
      .set(updateData)
      .where(and(eq(alerts.id, body.id), eq(alerts.userId, userId)))
      .returning()

    if (updatedAlert.length === 0) {
      return NextResponse.json({ error: "Alert not found or not owned by user" }, { status: 404 })
    }

    return NextResponse.json(updatedAlert[0])
  } catch (error) {
    console.error("Error updating alert:", error)
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 })
  }
}