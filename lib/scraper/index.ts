import { chromium, type Browser, type BrowserContext } from "playwright"
import { db } from "@/lib/db"
import { ads, competitors } from "@/lib/db/schema"
import { analyzeAdContent } from "@/lib/ai"
import { eq } from "drizzle-orm"
import { createAlert } from "@/lib/alerts"
import type { AdType, Platform, ScrapingResult, ScrapedAd } from "@/lib/types"

export const runtime = "nodejs"

// Browser configuration
const BROWSER_CONFIG = {
  headless: true,
  args: [
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-setuid-sandbox",
    "--no-sandbox",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-notifications",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-sync",
    "--disable-translate",
    "--hide-scrollbars",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
    "--safebrowsing-disable-auto-update",
  ],
  ignoreHTTPSErrors: true,
  timeout: 60000,
}

// Initialize browser instance
let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch(BROWSER_CONFIG)
  }
  return browser
}

// Create a stealth context to avoid detection
async function createStealthContext(): Promise<BrowserContext> {
  const browser = await getBrowser()
  return await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    locale: "en-US",
    timezoneId: "America/New_York",
    geolocation: { longitude: -73.935242, latitude: 40.73061 },
    permissions: ["geolocation"],
    javaScriptEnabled: true,
  })
}

// Retry mechanism for async functions
async function retry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number; onRetry?: (attempt: number, error: Error) => void },
): Promise<T> {
  const { retries, delay, onRetry } = options
  let lastError: Error

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (onRetry) onRetry(attempt + 1, lastError)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
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

    // Scrape each platform with concurrent execution
    const scrapePromises = platforms.map(async (platform) => {
      console.log(`Scraping ${platform} for ${competitor.name}`)
      try {
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
      } catch (platformError) {
        console.error(`Error scraping ${platform} for ${competitor.name}:`, platformError)
      }
    })

    // Wait for all scraping tasks to complete
    await Promise.all(scrapePromises)

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
  } finally {
    // Close the browser to free resources
    if (browser) {
      await browser.close()
      browser = null
    }
  }
}

async function scrapeFacebookAds(competitorName: string): Promise<ScrapedAd[]> {
  const context = await createStealthContext()
  const page = await context.newPage()

  try {
    // Set a shorter navigation timeout
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Navigate directly to the Facebook Ad Library with the search query
    const encodedName = encodeURIComponent(competitorName)
    await page.goto(`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${encodedName}`, {
      waitUntil: "domcontentloaded",
    })

    // Handle cookie consent if it appears
    try {
      await page.waitForSelector('button[data-testid="cookie-policy-manage-dialog-accept-button"]', { timeout: 5000 })
      await page.click('button[data-testid="cookie-policy-manage-dialog-accept-button"]')
    } catch {
      console.log("No cookie dialog appeared")
    }

    // Check if we need to log in or if we can proceed
    const isLoginPage = await page.evaluate(() => {
      return document.body.textContent?.includes("Log in to Facebook") || false
    })

    if (isLoginPage) {
      console.log("Facebook requires login. Using alternative scraping method...")
      // Use an alternative approach that doesn't require login
      return await scrapeFacebookAdsAlternative(competitorName, page)
    }

    // Wait for results to load with a more reliable selector
    try {
      await retry(
        async () => {
          await page.waitForSelector('div[role="main"] div[role="article"]', { timeout: 20000 })
        },
        {
          retries: 3,
          delay: 2000,
          onRetry: (attempt, error) => console.log(`Retry ${attempt} waiting for Facebook ads: ${error.message}`),
        },
      )
    } catch (error) {
      console.log("Could not find ad cards. Checking for no results message...")

      const noResults = await page.evaluate(() => {
        return document.body.textContent?.includes("No ads found for") || false
      })

      if (noResults) {
        console.log("No ads found for this competitor on Facebook")
        return []
      }

      throw error
    }

    // Scroll to load more ads (up to 3 times)
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1000)
    }

    // Extract ad data with a more robust selector strategy
    const ads = await page.evaluate(() => {
      const adCards = Array.from(document.querySelectorAll('div[role="article"]'))

      return adCards.map((card) => {
        // Determine ad type
        let type = "text"
        if (card.querySelector("video")) {
          type = "video"
        } else if (card.querySelector("img:not([alt*='profile'])")) {
          type = "image"
        }

        // Extract content with fallbacks
        const contentSelectors = [
          ".adLibraryTextContent",
          "div[data-ad-preview='message']",
          "div[data-testid='ad-text']",
          "div.x1iorvi4",
        ]

        let content = ""
        for (const selector of contentSelectors) {
          const element = card.querySelector(selector)
          if (element && element.textContent) {
            content = element.textContent.trim()
            break
          }
        }

        // Extract media URL
        let mediaUrl = ""
        if (type === "image") {
          const img = card.querySelector("img:not([alt*='profile'])")
          mediaUrl = img?.getAttribute("src") || ""
        } else if (type === "video") {
          mediaUrl = card.querySelector("video")?.getAttribute("src") || ""
        }

        // Extract landing page
        const landingPage =
          card.querySelector('a[data-testid="ad_library_card_cta_button"], a[target="_blank"]')?.getAttribute("href") ||
          ""

        // Extract date
        const dateElement = card.querySelector(".adLibraryStartDate, div[data-testid='ad-date']")
        const dateText = dateElement?.textContent || ""
        const dateMatch = dateText.match(/Started running on (.+)|Started (.+) ago/)
        const firstSeen = dateMatch ? new Date() : new Date()

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
    await context.close()
  }
}

// Alternative method for Facebook when login is required
async function scrapeFacebookAdsAlternative(competitorName: string, page: any): Promise<ScrapedAd[]> {
  try {
    // Try to extract any visible ad information even from the login page
    // Sometimes Facebook shows limited ad info even without login
    const limitedAds = await page.evaluate(() => {
      const adElements = Array.from(document.querySelectorAll('div[role="article"], .adLibraryCard'))

      return adElements.map((card) => {
        const content = card.textContent?.trim() || ""

        return {
          type: "text",
          content: content.substring(0, 500), // Limit content length
          mediaUrl: "",
          landingPage: "",
          firstSeen: new Date().toISOString(),
          isActive: true,
        }
      })
    })

    if (limitedAds.length > 0) {
      console.log(`Found ${limitedAds.length} ads with limited information`)
      return limitedAds as ScrapedAd[]
    }

    // If no ads found, try a different approach using Google search
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(`${competitorName} facebook ads`)}`, {
      waitUntil: "domcontentloaded",
    })

    await page.waitForSelector("#search", { timeout: 20000 })

    // Extract potential ad information from Google search results
    const searchResults = await page.evaluate(() => {
      const results = Array.from(document.querySelectorAll(".g"))

      return results.slice(0, 5).map((result) => {
        const title = result.querySelector("h3")?.textContent || ""
        const snippet = result.querySelector(".VwiC3b")?.textContent || ""

        return {
          type: "text",
          content: `${title} - ${snippet}`,
          mediaUrl: "",
          landingPage: result.querySelector("a")?.href || "",
          firstSeen: new Date().toISOString(),
          isActive: true,
        }
      })
    })

    return searchResults.filter(
      (ad: ScrapedAd) =>
        ad.content.toLowerCase().includes("ad") ||
        ad.content.toLowerCase().includes("campaign") ||
        ad.content.toLowerCase().includes("facebook"),
    ) as ScrapedAd[]
  } catch (error) {
    console.error("Error in Facebook alternative scraping:", error)
    return []
  }
}

async function scrapeGoogleAds(competitorName: string): Promise<ScrapedAd[]> {
  const context = await createStealthContext()
  const page = await context.newPage()

  try {
    // Set shorter timeouts
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Navigate directly to Google Ads Transparency Center with the search query
    const encodedName = encodeURIComponent(competitorName)
    await page.goto(`https://adstransparency.google.com/advertiser/${encodedName}?region=anywhere`, {
      waitUntil: "domcontentloaded",
    })

    // Check if we landed on the search page instead of direct results
    const isSearchPage = await page.evaluate(() => {
      return document.querySelector('input[aria-label="Search for an advertiser"]') !== null
    })

    if (isSearchPage) {
      // Fill the search input and submit
      await page.fill('input[aria-label="Search for an advertiser"]', competitorName)
      await page.keyboard.press("Enter")
      await page.waitForTimeout(3000)
    }

    // Wait for results with retry
    try {
      await retry(
        async () => {
          await page.waitForSelector(".advertiser-card, .ad-card, mat-card", { timeout: 20000 })
        },
        {
          retries: 3,
          delay: 2000,
          onRetry: (attempt, error) => console.log(`Retry ${attempt} waiting for Google ads: ${error.message}`),
        },
      )
    } catch (error) {
      // Check if no results
      const noResults = await page.evaluate(() => {
        return (
          document.body.textContent?.includes("No ads found") ||
          document.body.textContent?.includes("No advertisers found") ||
          false
        )
      })

      if (noResults) {
        console.log("No ads found for this competitor on Google")
        return []
      }

      throw error
    }

    // Scroll to load more ads
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1000)
    }

    // Extract ad data with multiple selector strategies
    const ads = await page.evaluate(() => {
      // Try different selectors for ad cards
      const selectors = [".advertiser-card", ".ad-card", "mat-card", "[role='listitem']"]
      let adCards: Element[] = []

      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector))
        if (elements.length > 0) {
          adCards = elements
          break
        }
      }

      return adCards.map((card) => {
        // Try different selectors for content
        const contentSelectors = [".ad-text", ".ad-content", ".ad-creative-text", "p", "div.text-content"]
        let content = ""

        for (const selector of contentSelectors) {
          const element = card.querySelector(selector)
          if (element && element.textContent) {
            content = element.textContent.trim()
            break
          }
        }

        // If no content found, get all text
        if (!content) {
          content = card.textContent?.trim() || ""
        }

        // Try different selectors for landing page
        const linkSelectors = ["a.ad-destination", "a[target='_blank']", "a.destination-url", "a"]
        let landingPage = ""

        for (const selector of linkSelectors) {
          const element = card.querySelector(selector)
          if (element) {
            landingPage = element.getAttribute("href") || ""
            break
          }
        }

        // Try different selectors for date
        const dateSelectors = [".ad-date", ".date-range", ".timestamp", "time"]
        let dateText = ""

        for (const selector of dateSelectors) {
          const element = card.querySelector(selector)
          if (element && element.textContent) {
            dateText = element.textContent.trim()
            break
          }
        }

        const firstSeen = dateText ? new Date(dateText) : new Date()

        return {
          type: "text",
          content,
          mediaUrl: "",
          landingPage,
          firstSeen: firstSeen.toISOString(),
          isActive: true,
        }
      })
    })

    return ads as ScrapedAd[]
  } catch (error) {
    console.error("Error scraping Google ads:", error)
    return []
  } finally {
    await page.close()
    await context.close()
  }
}

async function scrapeInstagramAds(competitorName: string): Promise<ScrapedAd[]> {
  const context = await createStealthContext()
  const page = await context.newPage()

  try {
    // Set shorter timeouts
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Navigate directly to Instagram with the search query
    await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" })

    // Handle cookie consent if it appears
    try {
      await page.waitForSelector('button[data-testid="cookie-policy-manage-dialog-accept-button"]', { timeout: 5000 })
      await page.click('button[data-testid="cookie-policy-manage-dialog-accept-button"]')
    } catch {
      console.log("No cookie dialog appeared")
    }

    // Check if login is required
    const isLoginPage = await page.evaluate(() => {
      return document.body.textContent?.includes("Log in") || document.body.textContent?.includes("Sign up") || false
    })

    if (isLoginPage) {
      console.log("Instagram requires login. Using alternative scraping method...")
      return await scrapeInstagramAlternative(competitorName, page)
    }

    // Search for the competitor
    try {
      await page.waitForSelector('input[placeholder="Search"], input[aria-label="Search"]', { timeout: 10000 })
      await page.fill('input[placeholder="Search"], input[aria-label="Search"]', competitorName)
      await page.waitForTimeout(2000)
      await page.keyboard.press("Enter")
    } catch (error) {
      console.log("Could not find search input, trying alternative method")
      return await scrapeInstagramAlternative(competitorName, page)
    }

    // Wait for search results
    try {
      await page.waitForSelector('a[href*="/explore/search/"]', { timeout: 10000 })
      await page.click('a[href*="/explore/search/"]')
    } catch {
      console.log("Could not find search results link")
    }

    // Try to find and click on the profile
    try {
      const profileSelector = `a[href^="/${competitorName.toLowerCase().replace(/\s+/g, "")}"]`
      await page.waitForSelector(profileSelector, { timeout: 10000 })
      await page.click(profileSelector)
    } catch {
      console.log("Could not find profile link")
    }

    // Wait for profile to load
    try {
      await page.waitForSelector("article", { timeout: 10000 })
    } catch {
      console.log("Could not find articles on profile")
      return []
    }

    // Extract posts
    const posts = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll("article"))

      return articles.map((article) => {
        let type = "image"
        if (article.querySelector("video")) {
          type = "video"
        }

        const content = article.querySelector(".caption")?.textContent?.trim() || article.textContent?.trim() || ""

        const mediaUrl =
          type === "image"
            ? article.querySelector("img")?.getAttribute("src") || ""
            : article.querySelector("video")?.getAttribute("src") || ""

        return {
          type,
          content,
          mediaUrl,
          landingPage: "",
          firstSeen: new Date().toISOString(),
          isActive: true,
        }
      })
    })

    return posts as ScrapedAd[]
  } catch (error) {
    console.error("Error scraping Instagram:", error)
    return []
  } finally {
    await page.close()
    await context.close()
  }
}

async function scrapeInstagramAlternative(competitorName: string, page: any): Promise<ScrapedAd[]> {
  try {
    // Use Google to find Instagram posts
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(`${competitorName} instagram ads`)}`, {
      waitUntil: "domcontentloaded",
    })

    await page.waitForSelector("#search", { timeout: 20000 })

    // Extract potential ad information from Google search results
    const searchResults = await page.evaluate(() => {
      const results = Array.from(document.querySelectorAll(".g"))

      return results.slice(0, 5).map((result) => {
        const title = result.querySelector("h3")?.textContent || ""
        const snippet = result.querySelector(".VwiC3b")?.textContent || ""
        const link = result.querySelector("a")?.href || ""

        return {
          type: "text",
          content: `${title} - ${snippet}`,
          mediaUrl: "",
          landingPage: link,
          firstSeen: new Date().toISOString(),
          isActive: true,
        }
      })
    })

    return searchResults.filter(
      (ad: ScrapedAd) => ad.content.toLowerCase().includes("instagram") || (ad.landingPage ?? "").toLowerCase().includes("instagram.com"),
    ) as ScrapedAd[]
  } catch (error) {
    console.error("Error in Instagram alternative scraping:", error)
    return []
  }
}

async function scrapeLinkedInAds(competitorName: string): Promise<ScrapedAd[]> {
  const context = await createStealthContext()
  const page = await context.newPage()

  try {
    // Set shorter timeouts
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Navigate to LinkedIn
    await page.goto("https://www.linkedin.com/", { waitUntil: "domcontentloaded" })

    // Handle cookie consent if it appears
    try {
      await page.waitForSelector('button[data-testid="cookie-policy-manage-dialog-accept-button"]', { timeout: 5000 })
      await page.click('button[data-testid="cookie-policy-manage-dialog-accept-button"]')
    } catch {
      console.log("No cookie dialog appeared")
    }

    // Check if login is required
    const isLoginPage = await page.evaluate(() => {
      return document.body.textContent?.includes("Sign in") || document.body.textContent?.includes("Join now") || false
    })

    if (isLoginPage) {
      console.log("LinkedIn requires login. Using alternative scraping method...")
      return await scrapeLinkedInAlternative(competitorName, page)
    }

    // Search for the competitor
    try {
      await page.waitForSelector('input[aria-label="Search"], input[placeholder="Search"]', { timeout: 10000 })
      await page.fill('input[aria-label="Search"], input[placeholder="Search"]', competitorName)
      await page.keyboard.press("Enter")
    } catch {
      console.log("Could not find search input")
      return await scrapeLinkedInAlternative(competitorName, page)
    }

    // Try to click on the Companies tab
    try {
      await page.waitForSelector('button[aria-label="Companies"], a[data-control-name="search_srp_companies"]', {
        timeout: 10000,
      })
      await page.click('button[aria-label="Companies"], a[data-control-name="search_srp_companies"]')
    } catch {
      console.log("Could not find Companies tab")
    }

    // Try to click on the first company result
    try {
      await page.waitForSelector(".search-result__info a, .entity-result__title a", { timeout: 10000 })
      await page.click(".search-result__info a, .entity-result__title a")
    } catch {
      console.log("Could not find company result")
      return await scrapeLinkedInAlternative(competitorName, page)
    }

    // Wait for company page to load
    try {
      await page.waitForSelector(".org-updates-section-container, .org-grid__content-height-enforcer", {
        timeout: 10000,
      })
    } catch {
      console.log("Could not find company updates section")
      return []
    }

    // Extract posts
    const posts = await page.evaluate(() => {
      const updates = Array.from(
        document.querySelectorAll(".org-updates-section-container .feed-shared-update-v2, .update-components-actor"),
      )

      return updates.map((update) => {
        let type = "text"
        if (update.querySelector("video")) {
          type = "video"
        } else if (update.querySelector(".feed-shared-image, .update-components-image")) {
          type = "image"
        }

        const content =
          update.querySelector(".feed-shared-text, .update-components-text")?.textContent?.trim() ||
          update.textContent?.trim() ||
          ""

        const mediaUrl =
          type === "image"
            ? update.querySelector(".feed-shared-image img, .update-components-image img")?.getAttribute("src") || ""
            : ""

        return {
          type,
          content,
          mediaUrl,
          landingPage: "",
          firstSeen: new Date().toISOString(),
          isActive: true,
        }
      })
    })

    return posts as ScrapedAd[]
  } catch (error) {
    console.error("Error scraping LinkedIn ads:", error)
    return []
  } finally {
    await page.close()
    await context.close()
  }
}

async function scrapeLinkedInAlternative(competitorName: string, page: any): Promise<ScrapedAd[]> {
  try {
    // Use Google to find LinkedIn posts
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(`${competitorName} linkedin ads`)}`, {
      waitUntil: "domcontentloaded",
    })

    await page.waitForSelector("#search", { timeout: 20000 })

    // Extract potential ad information from Google search results
    const searchResults = await page.evaluate(() => {
      const results = Array.from(document.querySelectorAll(".g"))

      return results.slice(0, 5).map((result) => {
        const title = result.querySelector("h3")?.textContent || ""
        const snippet = result.querySelector(".VwiC3b")?.textContent || ""
        const link = result.querySelector("a")?.href || ""

        return {
          type: "text",
          content: `${title} - ${snippet}`,
          mediaUrl: "",
          landingPage: link,
          firstSeen: new Date().toISOString(),
          isActive: true,
        }
      })
    })

    return searchResults.filter(
      (ad: ScrapedAd) => ad.content.toLowerCase().includes("linkedin") || (ad.landingPage ?? "").toLowerCase().includes("linkedin.com"),
    ) as ScrapedAd[]
  } catch (error) {
    console.error("Error in LinkedIn alternative scraping:", error)
    return []
  }
}

async function processScrapedData(competitorId: number, results: Record<Platform, ScrapedAd[]>): Promise<void> {
  try {
    // Get existing ads for this competitor
    const existingAds = await db.query.ads.findMany({
      where: eq(ads.competitorId, competitorId),
    })

    // Create a map of existing ad content for faster lookup
    const existingAdContentMap = new Map(existingAds.map((ad) => [ad.content, ad]))

    // Prepare arrays for batch operations
    const adsToUpdate = []
    const adsToInsert = []
    const alertPromises = []

    // Process ads from each platform
    for (const [platform, platformAds] of Object.entries(results)) {
      // Skip empty platform results
      if (platformAds.length === 0) continue

      console.log(`Processing ${platformAds.length} ads from ${platform}`)

      for (const adData of platformAds) {
        // Skip ads with empty content
        if (!adData.content || adData.content.trim() === "") continue

        const existingAd = existingAdContentMap.get(adData.content)

        if (existingAd) {
          // Update existing ad if needed
          if (existingAd.isActive !== adData.isActive) {
            adsToUpdate.push({
              id: existingAd.id,
              isActive: adData.isActive,
              lastSeen: new Date(),
              updatedAt: new Date(),
            })
          }
        } else {
          // This is a new ad, analyze it with AI
          try {
            const aiAnalysis = await analyzeAdContent(adData.content, adData.type as AdType)

            // Prepare data for insertion
            adsToInsert.push({
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

            // Prepare alert data
            alertPromises.push(
              createAlert({
                competitorId,
                type: "new_campaign",
                title: `New ${adData.type} ad on ${platform}`,
                description: `${adData.content.substring(0, 100)}${adData.content.length > 100 ? "..." : ""}`,
              }),
            )
          } catch (aiError) {
            console.error("Error analyzing ad content:", aiError)

            // Still insert the ad even if AI analysis fails
            adsToInsert.push({
              competitorId,
              platform: platform as Platform,
              type: adData.type as AdType,
              content: adData.content,
              mediaUrl: adData.mediaUrl || null,
              landingPage: adData.landingPage || null,
              firstSeen: new Date(adData.firstSeen),
              lastSeen: new Date(),
              isActive: adData.isActive,
              aiAnalysis: "Analysis failed",
            })
          }
        }
      }
    }

    // Execute batch operations in parallel for better performance
    const batchOperations = []

    // Execute batch updates
    if (adsToUpdate.length > 0) {
      console.log(`Updating ${adsToUpdate.length} existing ads`)
      batchOperations.push(Promise.all(adsToUpdate.map((ad) => db.update(ads).set(ad).where(eq(ads.id, ad.id)))))
    }

    // Execute batch insert in chunks to avoid DB limits
    if (adsToInsert.length > 0) {
      console.log(`Inserting ${adsToInsert.length} new ads`)
      const chunkSize = 50
      for (let i = 0; i < adsToInsert.length; i += chunkSize) {
        const chunk = adsToInsert.slice(i, i + chunkSize)
        batchOperations.push(db.insert(ads).values(chunk))
      }
    }

    // Wait for all database operations to complete
    await Promise.all(batchOperations)

    // Process alerts in parallel
    if (alertPromises.length > 0) {
      console.log(`Creating ${alertPromises.length} alerts`)
      await Promise.allSettled(alertPromises)
    }

    // Mark ads as inactive if they weren't found in this scrape
    const allScrapedContents = Object.values(results)
      .flat()
      .map((ad) => ad.content)
      .filter((content) => content && content.trim() !== "")

    if (allScrapedContents.length > 0) {
      const adsToDeactivate = existingAds.filter(
        (existingAd) => existingAd.isActive && !allScrapedContents.includes(existingAd.content),
      )

      if (adsToDeactivate.length > 0) {
        console.log(`Deactivating ${adsToDeactivate.length} ads that are no longer active`)

        const deactivatePromises = adsToDeactivate.map(async (ad) => {
          try {
            await createAlert({
              competitorId,
              type: "ad_change",
              title: `Ad removed from ${ad.platform}`,
              description: `${ad.content.substring(0, 100)}${ad.content.length > 100 ? "..." : ""}`,
            })

            return db
              .update(ads)
              .set({
                isActive: false,
                updatedAt: new Date(),
              })
              .where(eq(ads.id, ad.id))
          } catch (error) {
            console.error("Error creating alert for deactivated ad:", error)
            return db
              .update(ads)
              .set({
                isActive: false,
                updatedAt: new Date(),
              })
              .where(eq(ads.id, ad.id))
          }
        })

        await Promise.allSettled(deactivatePromises)
      }
    }
  } catch (error) {
    console.error("Error processing scraped data:", error)
  }
}