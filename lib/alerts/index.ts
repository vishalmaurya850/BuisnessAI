import { db } from "@/lib/db"
import { alerts, businesses, users, userPreferences, competitors } from "@/lib/db/schema"
import type { AlertData, AlertResponseData } from "@/lib/types"
import { eq } from "drizzle-orm"
import nodemailer from "nodemailer"

export async function createAlert(data: AlertData): Promise<AlertResponseData> {
  try {
    // If businessId is not provided, get it from the competitor
    let businessId = data.businessId

    if (!businessId) {
      const competitor = await db.query.competitors.findFirst({
        where: eq(competitors.id, data.competitorId),
      })

      if (!competitor) {
        throw new Error(`Competitor with ID ${data.competitorId} not found`)
      }

      businessId = competitor.businessId
    }

    // Create the alert
    const [alert] = await db
      .insert(alerts)
      .values({
        businessId,
        competitorId: data.competitorId,
        type: data.type,
        title: data.title,
        description: data.description,
        isImportant: data.isImportant || false,
      })
      .returning()

    // Send email notification if enabled
    await sendAlertEmail(alert.id)

    return alert as unknown as AlertResponseData
  } catch (error) {
    console.error("Error creating alert:", error)
    throw error
  }
}

async function sendAlertEmail(alertId: number): Promise<void> {
  try {
    // Get the alert details
    const alert = await db.query.alerts.findFirst({
      where: eq(alerts.id, alertId),
    })

    if (!alert) {
      throw new Error(`Alert with ID ${alertId} not found`)
    }

    // Get the business details
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.id, alert.businessId),
    })

    if (!business) {
      throw new Error(`Business with ID ${alert.businessId} not found`)
    }

    // Get the competitor details
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, alert.competitorId),
    })

    if (!competitor) {
      throw new Error(`Competitor with ID ${alert.competitorId} not found`)
    }

    // Get the user's email
    const user = await db.query.users.findFirst({
      where: eq(users.id, business.userId),
    })

    if (!user || !user.email) {
      console.log("User email not found, skipping email notification")
      return
    }

    // Check if email notifications are enabled for this user
    const userPrefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, user.id),
    })

    if (!userPrefs || !userPrefs.emailNotifications) {
      console.log("Email notifications disabled for user, skipping")
      return
    }

    // Initialize email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "",
      port: Number.parseInt(process.env.EMAIL_PORT || "587"),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER || "",
        pass: process.env.EMAIL_PASSWORD || "",
      },
    })

    // Send the email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "noreply@competitorai.com",
      to: user.email,
      subject: `CompetitorAI Alert: ${alert.title}`,
      html: `
        <h1>CompetitorAI Alert</h1>
        <h2>${alert.title}</h2>
        <p>${alert.description}</p>
        <p><strong>Competitor:</strong> ${competitor.name}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/alerts/${alert.id}">View details</a></p>
      `,
    })

    console.log(`Email notification sent to ${user.email} for alert ${alertId}`)
  } catch (error) {
    console.error("Error sending alert email:", error)
  }
}

export async function markAlertAsRead(alertId: number): Promise<AlertResponseData> {
  try {
    const [updatedAlert] = await db.update(alerts).set({ isRead: true }).where(eq(alerts.id, alertId)).returning()

    return updatedAlert as unknown as AlertResponseData
  } catch (error) {
    console.error("Error marking alert as read:", error)
    throw error
  }
}

export async function markAlertAsImportant(alertId: number, isImportant: boolean): Promise<AlertResponseData> {
  try {
    const [updatedAlert] = await db.update(alerts).set({ isImportant }).where(eq(alerts.id, alertId)).returning()

    return updatedAlert as unknown as AlertResponseData
  } catch (error) {
    console.error("Error updating alert importance:", error)
    throw error
  }
}
