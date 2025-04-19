import { chromium, type Browser } from "playwright"
import { db } from "@/lib/db"
import { ads, competitors } from "@/lib/db/schema"
import { analyzeAdContent } from "@/lib/ai"
import { eq } from "drizzle-orm"
import { createAlert } from "@/lib/alerts"
import type { AdType, Platform, ScrapingResult, ScrapedAd } from "@/lib/types"

// Initialize browser instance
let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    })
  }
  return browser
}

export async function initScraper(): Promise<Browser> {
  const browser = await getBrowser()
  console.log("Scraper initialized")
  return browser
}

export async function closeScraper(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
    console.log("Scraper closed")
  }
}

export async function scrapeCompetitor(competitorId: number): Promise<ScrapingResult> {
  try {
    // Get competitor details
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    })

    if (!competitor) {
      throw new Error(`Competitor with ID ${competitorId} not found`)
    }

    console.log(`Starting scrape for competitor: ${competitor.name}`)

    // Determine which platforms to scrape
    const platforms: Platform[] = []
    if (competitor.trackFacebook) platforms.push("facebook")
    if (competitor.trackGoogle) platforms.push("google")
    if (competitor.trackInstagram) platforms.push("instagram")
    if (competitor.trackLinkedIn) platforms.push("linkedin")

    // Initialize results
    const results: Record<Platform, ScrapedAd[]> = {
      facebook: [],
      google: [],
      instagram: [],
      linkedin: [],
      twitter: [],
      tiktok: [],
      other: [],
    }

    // Scrape each platform
    for (const platform of platforms) {
      console.log(`Scraping ${platform} for ${competitor.name}`)

      switch (platform) {
        case "facebook":
          results.facebook = await scrapeFacebookAds(competitor.name)
          break
        case "google":
          results.google = await scrapeGoogleAds(competitor.name)
          break
        case "instagram":
          results.instagram = await scrapeInstagramAds(competitor.name)
          break
        case "linkedin":
          results.linkedin = await scrapeLinkedInAds(competitor.name)
          break
      }
    }

    // Process and store results
    await processScrapedData(competitorId, results)

    // Update last scraped timestamp
    await db
      .update(competitors)
      .set({
        lastScraped: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(competitors.id, competitorId))

    return { success: true, competitorId, results }
  } catch (error) {
    console.error(`Error scraping competitor ${competitorId}:`, error)
    return { success: false, competitorId, error: (error as Error).message }
  }
}

async function scrapeFacebookAds(competitorName: string): Promise<ScrapedAd[]> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    // Navigate to Facebook Ad Library
    await page.goto("https://www.facebook.com/ads/library/")

    // Accept cookies if prompted
    try {
      await page.click('button[data-testid="cookie-policy-manage-dialog-accept-button"]', { timeout: 5000 })
    } catch  {
      // Cookie dialog might not appear, so we can ignore this error
    }

    // Search for the competitor
    await page.fill('input[aria-label="Search by advertiser name or keyword"]', competitorName)
    await page.press('input[aria-label="Search by advertiser name or keyword"]', "Enter")

    // Wait for results to load
    await page.waitForSelector(".adLibraryCard", { timeout: 10000 }).catch(() => null)

    // Extract ad data
    const ads = await page.evaluate(() => {
      const adCards = Array.from(document.querySelectorAll(".adLibraryCard"))

      return adCards.map((card) => {
        // Determine ad type based on content
        let type = "text"
        if (card.querySelector("video")) {
          type = "video"
        } else if (card.querySelector("img:not(.adLibraryHeaderImage)")) {
          type = "image"
        }

        // Extract content
        const content = card.querySelector(".adLibraryTextContent")?.textContent?.trim() || ""

        // Extract media URL if available
        let mediaUrl = ""
        if (type === "image") {
          mediaUrl = card.querySelector("img:not(.adLibraryHeaderImage)")?.getAttribute("src") || ""
        } else if (type === "video") {
          mediaUrl = card.querySelector("video")?.getAttribute("src") || ""
        }

        // Extract landing page if available
        const landingPage =
          card.querySelector('a[data-testid="ad_library_card_cta_button"]')?.getAttribute("href") || ""

        // Extract start date
        const startDateText = card.querySelector(".adLibraryStartDate")?.textContent || ""
        const startDateMatch = startDateText.match(/Started running on (.+)/)
        const firstSeen = startDateMatch ? new Date(startDateMatch[1]) : new Date()

        return {
          type,
          content,
          mediaUrl,
          landingPage,
          firstSeen: firstSeen.toISOString(),
          isActive: true,
        }
      })
    })

    return ads as ScrapedAd[]
  } catch (error) {
    console.error("Error scraping Facebook ads:", error)
    return []
  } finally {
    await page.close()
  }
}

async function scrapeGoogleAds(competitorName: string): Promise<ScrapedAd[]> {
  // Implementation remains the same, just with proper return type
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    // Navigate to Google Ads Transparency Center
    await page.goto("https://adstransparency.google.com/")

    // Search for the competitor
    await page.fill('input[aria-label="Search for an advertiser"]', competitorName)
    await page.press('input[aria-label="Search for an advertiser"]', "Enter")

    // Wait for results to load
    await page.waitForSelector(".advertiser-card", { timeout: 10000 }).catch(() => null)

    // Click on the first result
    const firstResult = await page.$(".advertiser-card")
    if (firstResult) {
      await firstResult.click()

      // Wait for ad details to load
      await page.waitForSelector(".ad-card", { timeout: 10000 }).catch(() => null)

      // Extract ad data
      const ads = await page.evaluate(() => {
        const adCards = Array.from(document.querySelectorAll(".ad-card"))

        return adCards.map((card) => {
          // Google Ads are primarily text-based
          const type: string = "text"

          // Extract content
          const content = card.querySelector(".ad-text")?.textContent?.trim() || ""

          // Extract landing page if available
          const landingPage = card.querySelector("a.ad-destination")?.getAttribute("href") || ""

          // Extract date information
          const dateText = card.querySelector(".ad-date")?.textContent || ""
          const firstSeen = dateText ? new Date(dateText) : new Date()

          return {
            type,
            content,
            mediaUrl: "",
            landingPage,
            firstSeen: firstSeen.toISOString(),
            isActive: true,
          }
        })
      })

      return ads as ScrapedAd[]
    }

    return []
  } catch (error) {
    console.error("Error scraping Google ads:", error)
    return []
  } finally {
    await page.close()
  }
}

async function scrapeInstagramAds(competitorName: string): Promise<ScrapedAd[]> {
  // Implementation remains the same, just with proper return type
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    // Navigate to Instagram
    await page.goto("https://www.instagram.com/")

    // Accept cookies if prompted
    try {
      await page.click('button[data-testid="cookie-policy-manage-dialog-accept-button"]', { timeout: 5000 })
    } catch {
      // Cookie dialog might not appear, so we can ignore this error
    }

    // Search for the competitor
    await page.fill('input[placeholder="Search"]', competitorName)
    await page.waitForSelector('a[href*="/explore/search/"]', { timeout: 5000 })
    await page.click('a[href*="/explore/search/"]')

    // Click on the first profile result
    await page.waitForSelector('a[href^="/' + competitorName.toLowerCase().replace(/\s+/g, "") + '"]', {
      timeout: 5000,
    })
    await page.click('a[href^="/' + competitorName.toLowerCase().replace(/\s+/g, "") + '"]')

    // Wait for profile to load
    await page.waitForSelector("article", { timeout: 10000 })

    // Extract posts (some might be ads)
    const posts = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll("article"))

      return articles
        .slice(0, 10)
        .map((article) => {
          // Determine post type
          let type = "image"
          if (article.querySelector("video")) {
            type = "video"
          }

          // Extract content
          const content = article.querySelector(".caption")?.textContent?.trim() || ""

          // Extract media URL
          let mediaUrl = ""
          if (type === "image") {
            mediaUrl = article.querySelector("img")?.getAttribute("src") || ""
          } else if (type === "video") {
            mediaUrl = article.querySelector("video")?.getAttribute("src") || ""
          }

          // We don't have a reliable way to determine if a post is an ad
          // For demonstration, we'll assume posts with promotional keywords are ads
          const promotionalKeywords = ["buy", "sale", "discount", "offer", "limited", "new", "shop", "order"]
          const isLikelyAd = promotionalKeywords.some((keyword) => content.toLowerCase().includes(keyword))

          if (!isLikelyAd) {
            return null
          }

          return {
            type,
            content,
            mediaUrl,
            landingPage: "",
            firstSeen: new Date().toISOString(),
            isActive: true,
          }
        })
        .filter(Boolean)
    })

    return posts as ScrapedAd[]
  } catch (error) {
    console.error("Error scraping Instagram:", error)
    return []
  } finally {
    await page.close()
  }
}

async function scrapeLinkedInAds(competitorName: string): Promise<ScrapedAd[]> {
  // Implementation remains the same, just with proper return type
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    // Navigate to LinkedIn
    await page.goto("https://www.linkedin.com/")

    // Accept cookies if prompted
    try {
      await page.click('button[action-type="ACCEPT"]', { timeout: 5000 })
    } catch {
      // Cookie dialog might not appear, so we can ignore this error
    }

    // Search for the competitor
    await page.fill('input[aria-label="Search"]', competitorName)
    await page.press('input[aria-label="Search"]', "Enter")

    // Click on the Companies tab
    await page.waitForSelector('button[aria-label="Companies"]', { timeout: 5000 })
    await page.click('button[aria-label="Companies"]')

    // Click on the first company result
    await page.waitForSelector(".search-result__info", { timeout: 5000 })
    await page.click(".search-result__info a")

    // Wait for company page to load
    await page.waitForSelector(".org-updates-section-container", { timeout: 10000 })

    // Extract posts (some might be ads)
    const posts = await page.evaluate(() => {
      const updates = Array.from(document.querySelectorAll(".org-updates-section-container .feed-shared-update-v2"))

      return updates
        .slice(0, 10)
        .map((update) => {
          // Determine post type
          let type = "text"
          if (update.querySelector("video")) {
            type = "video"
          } else if (update.querySelector(".feed-shared-image")) {
            type = "image"
          }

          // Extract content
          const content = update.querySelector(".feed-shared-text")?.textContent?.trim() || ""

          // Extract media URL
          let mediaUrl = ""
          if (type === "image") {
            mediaUrl = update.querySelector(".feed-shared-image img")?.getAttribute("src") || ""
          }

          // We don't have a reliable way to determine if a post is an ad
          // For demonstration, we'll assume posts with promotional keywords are ads
          const promotionalKeywords = [
            "announcement",
            "introducing",
            "new",
            "launch",
            "offer",
            "learn more",
            "register",
          ]
          const isLikelyAd = promotionalKeywords.some((keyword) => content.toLowerCase().includes(keyword))

          if (!isLikelyAd) {
            return null
          }

          return {
            type,
            content,
            mediaUrl,
            landingPage: "",
            firstSeen: new Date().toISOString(),
            isActive: true,
          }
        })
        .filter(Boolean)
    })

    return posts as ScrapedAd[]
  } catch (error) {
    console.error("Error scraping LinkedIn:", error)
    return []
  } finally {
    await page.close()
  }
}

async function processScrapedData(competitorId: number, results: Record<Platform, ScrapedAd[]>): Promise<void> {
  // Get existing ads for this competitor
  const existingAds = await db.query.ads.findMany({
    where: eq(ads.competitorId, competitorId),
  })

  // Process ads from each platform
  for (const [platform, platformAds] of Object.entries(results)) {
    for (const adData of platformAds) {
      // Check if this ad already exists (based on content and platform)
      const existingAd = existingAds.find(
        (ad) => ad.content === adData.content && ad.platform === (platform as Platform),
      )

      if (existingAd) {
        // Update existing ad if needed
        if (existingAd.isActive !== adData.isActive) {
          await db
            .update(ads)
            .set({
              isActive: adData.isActive,
              lastSeen: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(ads.id, existingAd.id))
        }
      } else {
        // This is a new ad, analyze it with AI
        const aiAnalysis = await analyzeAdContent(adData.content, adData.type as AdType)

        // Insert the new ad
        await db
          .insert(ads)
          .values({
            competitorId,
            platform: platform as Platform,
            type: adData.type as AdType,
            content: adData.content,
            mediaUrl: adData.mediaUrl || null,
            landingPage: adData.landingPage || null,
            firstSeen: new Date(adData.firstSeen),
            lastSeen: new Date(),
            isActive: adData.isActive,
            aiAnalysis,
          })
          .returning()

        // Create an alert for the new ad
        await createAlert({
          competitorId,
          type: "new_campaign",
          title: `New ${adData.type} ad on ${platform}`,
          description: `${adData.content.substring(0, 100)}${adData.content.length > 100 ? "..." : ""}`,
        })
      }
    }
  }

  // Mark ads as inactive if they weren't found in this scrape
  const allScrapedContents = Object.values(results)
    .flat()
    .map((ad) => ad.content)

  for (const existingAd of existingAds) {
    if (existingAd.isActive && !allScrapedContents.includes(existingAd.content)) {
      await db
        .update(ads)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(ads.id, existingAd.id))

      // Create an alert for the removed ad
      await createAlert({
        competitorId,
        type: "ad_change",
        title: `Ad removed from ${existingAd.platform}`,
        description: `${existingAd.content.substring(0, 100)}${existingAd.content.length > 100 ? "..." : ""}`,
      })
    }
  }
}