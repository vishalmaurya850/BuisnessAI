import { chromium, type Browser, type BrowserContext } from "playwright"
import { db } from "@/lib/db"
import { ads, competitors } from "@/lib/db/schema"
import { analyzeAdContent } from "@/lib/ai"
import { eq } from "drizzle-orm"
import { createAlert } from "@/lib/alerts"
import type { AdType, Platform, ScrapingResult, ScrapedAd } from "@/lib/types"
import { crawlCompetitorWebsite } from "./website-crawler"

export const runtime = "nodejs"

// Browser configuration with enhanced anti-detection settings
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
    // Additional args to help with anti-bot detection
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
  ],
  ignoreHTTPSErrors: true,
  timeout: 60000,
}

// Initialize browser instance
let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    try {
      browser = await chromium.launch(BROWSER_CONFIG)
    } catch (error) {
      console.error("Error launching browser:", error)
      // Force a new browser instance
      browser = null
      browser = await chromium.launch(BROWSER_CONFIG)
    }
  }
  return browser
}

// Create a stealth context to avoid detection
async function createStealthContext(): Promise<BrowserContext> {
  const browser = await getBrowser()

  // Rotate user agents to avoid detection
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  ]

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

  return await browser.newContext({
    userAgent: randomUserAgent,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    locale: "en-US",
    timezoneId: "America/New_York",
    geolocation: { longitude: -73.935242, latitude: 40.73061 },
    permissions: ["geolocation"],
    javaScriptEnabled: true,
    // Add extra HTTP headers to appear more like a real browser
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "sec-ch-ua": '"Chromium";v="123", "Google Chrome";v="123"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  })
}

// Safe page evaluation that handles errors
async function safeEvaluate<T>(page: any, fn: () => T, defaultValue: T): Promise<T> {
  try {
    return await page.evaluate(fn)
  } catch (error) {
    console.error("Error during page evaluation:", error)
    return defaultValue
  }
}

// Retry mechanism with exponential backoff
async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries: number
    initialDelay: number
    maxDelay?: number
    factor?: number
    onRetry?: (attempt: number, error: Error, delay: number) => void
  },
): Promise<T> {
  const { retries, initialDelay, maxDelay = 30000, factor = 2, onRetry } = options
  let lastError: Error
  let delay = initialDelay

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * factor, maxDelay)

      if (onRetry) onRetry(attempt + 1, lastError, delay)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

// Safe selector waiting that doesn't throw if not found
async function waitForSelectorSafe(page: any, selector: string, options: { timeout: number }): Promise<boolean> {
  try {
    await page.waitForSelector(selector, options)
    return true
  } catch (error) {
    return false
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

    // First, try to scrape from ad platforms
    const platforms: Platform[] = []
    if (competitor.trackFacebook) platforms.push("facebook")
    if (competitor.trackGoogle) platforms.push("google")
    if (competitor.trackInstagram) platforms.push("instagram")
    if (competitor.trackLinkedIn) platforms.push("linkedin")

    // Scrape each platform sequentially to avoid browser resource issues
    for (const platform of platforms) {
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
        // Continue with other platforms even if one fails
      }

      // Add a delay between platform scraping to avoid detection
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    // Now, crawl the competitor's website directly
    console.log(`Crawling website for ${competitor.name}`)
    try {
      const websiteAds = await crawlCompetitorWebsite(competitorId, 15) // Crawl up to 15 pages
      results.other = websiteAds
    } catch (crawlError) {
      console.error(`Error crawling website for ${competitor.name}:`, crawlError)
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
  } finally {
    // Close the browser to free resources
    if (browser) {
      try {
        await browser.close()
      } catch (error) {
        console.error("Error closing browser:", error)
      }
      browser = null
    }
  }
}

async function scrapeFacebookAds(competitorName: string): Promise<ScrapedAd[]> {
  let context: BrowserContext | null = null
  let page: any = null

  try {
    context = await createStealthContext()
    page = await context.newPage()

    // Set a shorter navigation timeout
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Add random mouse movements to appear more human-like
    await page.mouse.move(100 + Math.random() * 100, 100 + Math.random() * 100)

    // Navigate directly to the Facebook Ad Library with the search query
    const encodedName = encodeURIComponent(competitorName)
    await page.goto(`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${encodedName}`, {
      waitUntil: "domcontentloaded",
    })

    // Handle cookie consent if it appears
    const hasCookieDialog = await waitForSelectorSafe(
      page,
      'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
      { timeout: 5000 },
    )

    if (hasCookieDialog) {
      await page.click('button[data-testid="cookie-policy-manage-dialog-accept-button"]')
    }

    // Check if we need to log in or if we can proceed
    const isLoginPage = await safeEvaluate(
      page,
      () => document.body.textContent?.includes("Log in to Facebook") || false,
      false,
    )

    if (isLoginPage) {
      console.log("Facebook requires login. Using alternative scraping method...")
      // Use an alternative approach that doesn't require login
      return await scrapeFacebookAdsAlternative(competitorName)
    }

    // Wait for results to load with a more reliable selector
    const hasResults = await waitForSelectorSafe(
      page,
      'div[role="main"] div[role="article"], .adLibraryCard, [data-testid="ad_card"]',
      { timeout: 15000 },
    )

    if (!hasResults) {
      console.log("Could not find ad cards. Checking for no results message...")

      const noResults = await safeEvaluate(
        page,
        () => document.body.textContent?.includes("No ads found for") || false,
        false,
      )

      if (noResults) {
        console.log("No ads found for this competitor on Facebook")
        return []
      }

      // If we can't find ads and there's no "no results" message, try the alternative method
      return await scrapeFacebookAdsAlternative(competitorName)
    }

    // Scroll to load more ads (up to 3 times)
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1000)
    }

    // Extract ad data with a more robust selector strategy
    const ads = await safeEvaluate(
      page,
      () => {
        // Try multiple selectors to find ad cards
        const selectors = ['div[role="article"]', ".adLibraryCard", '[data-testid="ad_card"]', ".x1i10hfl"]

        let adCards: Element[] = []

        for (const selector of selectors) {
          const elements = Array.from(document.querySelectorAll(selector))
          if (elements.length > 0) {
            adCards = elements
            break
          }
        }

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
            ".x1lliihq",
            "span.x193iq5w",
          ]

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
            card
              .querySelector('a[data-testid="ad_library_card_cta_button"], a[target="_blank"]')
              ?.getAttribute("href") || ""

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
      },
      [],
    )

    return ads as ScrapedAd[]
  } catch (error) {
    console.error("Error scraping Facebook ads:", error)
    // Try alternative method if primary method fails
    return await scrapeFacebookAdsAlternative(competitorName)
  } finally {
    if (page) {
      try {
        await page.close()
      } catch (e) {
        console.error("Error closing page:", e)
      }
    }
    if (context) {
      try {
        await context.close()
      } catch (e) {
        console.error("Error closing context:", e)
      }
    }
  }
}

// Alternative method for Facebook when login is required
async function scrapeFacebookAdsAlternative(competitorName: string): Promise<ScrapedAd[]> {
  let context: BrowserContext | null = null
  let page: any = null

  try {
    context = await createStealthContext()
    page = await context.newPage()

    // Set shorter timeouts
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Use Google to find Facebook ads
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(`${competitorName} facebook ads OR marketing`)}`,
      {
        waitUntil: "domcontentloaded",
      },
    )

    // Wait for search results with a more reliable approach
    const hasResults = await waitForSelectorSafe(page, "#search", { timeout: 15000 })

    if (!hasResults) {
      console.log("Google search results not found, returning empty array")
      return []
    }

    // Extract potential ad information from Google search results
    const searchResults = await safeEvaluate(
      page,
      () => {
        const results = Array.from(document.querySelectorAll(".g"))

        return results.slice(0, 8).map((result) => {
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
      },
      [],
    )

    // Filter results to only include relevant Facebook ad content
    return searchResults.filter(
      (ad: ScrapedAd) =>
        ad.content.toLowerCase().includes("ad") ||
        ad.content.toLowerCase().includes("campaign") ||
        ad.content.toLowerCase().includes("facebook") ||
        ad.content.toLowerCase().includes("marketing") ||
        (ad.landingPage && ad.landingPage.includes("facebook.com")),
    ) as ScrapedAd[]
  } catch (error) {
    console.error("Error in Facebook alternative scraping:", error)
    return []
  } finally {
    if (page) {
      try {
        await page.close()
      } catch (e) {
        console.error("Error closing page:", e)
      }
    }
    if (context) {
      try {
        await context.close()
      } catch (e) {
        console.error("Error closing context:", e)
      }
    }
  }
}

async function scrapeGoogleAds(competitorName: string): Promise<ScrapedAd[]> {
  let context: BrowserContext | null = null
  let page: any = null

  try {
    context = await createStealthContext()
    page = await context.newPage()

    // Set shorter timeouts
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Try direct approach first
    try {
      // Navigate directly to Google Ads Transparency Center with the search query
      const encodedName = encodeURIComponent(competitorName)
      await page.goto(`https://adstransparency.google.com/advertiser/${encodedName}?region=anywhere`, {
        waitUntil: "domcontentloaded",
      })

      // Check if we landed on the search page instead of direct results
      const isSearchPage = await safeEvaluate(
        page,
        () => document.querySelector('input[aria-label="Search for an advertiser"]') !== null,
        false,
      )

      if (isSearchPage) {
        // Fill the search input and submit
        await page.fill('input[aria-label="Search for an advertiser"]', competitorName)
        await page.keyboard.press("Enter")
        await page.waitForTimeout(3000)
      }

      // Wait for results with a more reliable approach
      const hasResults = await waitForSelectorSafe(page, ".advertiser-card, .ad-card, mat-card, [role='listitem']", {
        timeout: 15000,
      })

      if (!hasResults) {
        // Check if no results
        const noResults = await safeEvaluate(
          page,
          () => {
            return (
              document.body.textContent?.includes("No ads found") ||
              document.body.textContent?.includes("No advertisers found") ||
              false
            )
          },
          false,
        )

        if (noResults) {
          console.log("No ads found for this competitor on Google")
          return []
        }

        // If we can't find ads and there's no "no results" message, try the alternative method
        console.log("Could not find Google ad cards, trying alternative method")
      }

      // Scroll to load more ads
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(1000)
      }

      // Extract ad data with multiple selector strategies
      const ads = await safeEvaluate(
        page,
        () => {
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
        },
        [],
      )

      return ads as ScrapedAd[]
    } catch (directError) {
      console.error("Direct Google Ads scraping failed:", directError)
      // Fall back to alternative method
      return await scrapeGoogleAdsAlternative(competitorName)
    }
  } catch (error) {
    console.error("Error scraping Google ads:", error)
    return await scrapeGoogleAdsAlternative(competitorName)
  } finally {
    if (page) {
      try {
        await page.close()
      } catch (e) {
        console.error("Error closing page:", e)
      }
    }
    if (context) {
      try {
        await context.close()
      } catch (e) {
        console.error("Error closing context:", e)
      }
    }
  }
}

// Alternative method for Google Ads
async function scrapeGoogleAdsAlternative(competitorName: string): Promise<ScrapedAd[]> {
  let context: BrowserContext | null = null
  let page: any = null

  try {
    context = await createStealthContext()
    page = await context.newPage()

    // Set shorter timeouts
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Use Google search to find ads
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(`${competitorName} ads OR "sponsored" OR "advertisement"`)}`,
      {
        waitUntil: "domcontentloaded",
      },
    )

    // Wait for search results with a more reliable approach
    const hasResults = await waitForSelectorSafe(page, "#search", { timeout: 15000 })

    if (!hasResults) {
      console.log("Google search results not found, returning empty array")
      return []
    }

    // Look for sponsored results first
    const hasSponsored = await waitForSelectorSafe(page, ".uEierd", { timeout: 5000 })

    if (hasSponsored) {
      // Extract sponsored ad information
      const sponsoredAds = await safeEvaluate(
        page,
        () => {
          const sponsored = Array.from(document.querySelectorAll(".uEierd"))

          return sponsored.map((ad) => {
            const title = ad.querySelector("div.v5yQqb")?.textContent || ad.querySelector("h3")?.textContent || ""
            const description = ad.querySelector(".MUxGbd")?.textContent || ""
            const link = ad.querySelector("a")?.href || ""

            return {
              type: "text",
              content: `${title} - ${description}`,
              mediaUrl: "",
              landingPage: link,
              firstSeen: new Date().toISOString(),
              isActive: true,
            }
          })
        },
        [],
      )

      if (sponsoredAds.length > 0) {
        return sponsoredAds as ScrapedAd[]
      }
    }

    // Extract regular search results as fallback
    const searchResults = await safeEvaluate(
      page,
      () => {
        const results = Array.from(document.querySelectorAll(".g"))

        return results.slice(0, 8).map((result) => {
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
      },
      [],
    )

    // Filter results to only include relevant ad content
    return searchResults.filter(
      (ad: ScrapedAd) =>
        ad.content.toLowerCase().includes("ad") ||
        ad.content.toLowerCase().includes("sponsored") ||
        ad.content.toLowerCase().includes("advertisement") ||
        ad.content.toLowerCase().includes("campaign"),
    ) as ScrapedAd[]
  } catch (error) {
    console.error("Error in Google alternative scraping:", error)
    return []
  } finally {
    if (page) {
      try {
        await page.close()
      } catch (e) {
        console.error("Error closing page:", e)
      }
    }
    if (context) {
      try {
        await context.close()
      } catch (e) {
        console.error("Error closing context:", e)
      }
    }
  }
}

async function scrapeInstagramAds(competitorName: string): Promise<ScrapedAd[]> {
  // Skip direct Instagram scraping as it consistently fails with login requirements
  // Go straight to the alternative method which is more reliable
  return await scrapeInstagramAlternative(competitorName)
}

async function scrapeInstagramAlternative(competitorName: string): Promise<ScrapedAd[]> {
  let context: BrowserContext | null = null
  let page: any = null

  try {
    context = await createStealthContext()
    page = await context.newPage()

    // Set shorter timeouts
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Use Google to find Instagram posts
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(`${competitorName} instagram sponsored OR "paid partnership" OR ad`)}`,
      {
        waitUntil: "domcontentloaded",
      },
    )

    // Wait for search results with a more reliable approach
    const hasResults = await waitForSelectorSafe(page, "#search", { timeout: 15000 })

    if (!hasResults) {
      console.log("Google search results not found for Instagram alternative, returning empty array")
      return []
    }

    // Extract potential ad information from Google search results
    const searchResults = await safeEvaluate(
      page,
      () => {
        const results = Array.from(document.querySelectorAll(".g"))

        return results.slice(0, 8).map((result) => {
          const title = result.querySelector("h3")?.textContent || ""
          const snippet = result.querySelector(".VwiC3b")?.textContent || ""
          const link = result.querySelector("a")?.href || ""

          // Try to determine if it's an image or video based on the snippet
          let type = "text"
          if (
            snippet.toLowerCase().includes("video") ||
            snippet.toLowerCase().includes("watch") ||
            snippet.toLowerCase().includes("reel")
          ) {
            type = "video"
          } else if (
            snippet.toLowerCase().includes("photo") ||
            snippet.toLowerCase().includes("image") ||
            snippet.toLowerCase().includes("picture")
          ) {
            type = "image"
          }

          return {
            type,
            content: `${title} - ${snippet}`,
            mediaUrl: "",
            landingPage: link,
            firstSeen: new Date().toISOString(),
            isActive: true,
          }
        })
      },
      [],
    )

    // Filter results to only include relevant Instagram content
    return searchResults.filter(
      (ad: ScrapedAd) =>
        (ad.content.toLowerCase().includes("instagram") ||
          (ad.landingPage && ad.landingPage.includes("instagram.com"))) &&
        (ad.content.toLowerCase().includes("sponsored") ||
          ad.content.toLowerCase().includes("paid partnership") ||
          ad.content.toLowerCase().includes("ad") ||
          ad.content.toLowerCase().includes("promotion")),
    ) as ScrapedAd[]
  } catch (error) {
    console.error("Error in Instagram alternative scraping:", error)
    return []
  } finally {
    if (page) {
      try {
        await page.close()
      } catch (e) {
        console.error("Error closing page:", e)
      }
    }
    if (context) {
      try {
        await context.close()
      } catch (e) {
        console.error("Error closing context:", e)
      }
    }
  }
}

async function scrapeLinkedInAds(competitorName: string): Promise<ScrapedAd[]> {
  // Skip direct LinkedIn scraping as it consistently fails with login requirements
  // Go straight to the alternative method which is more reliable
  return await scrapeLinkedInAlternative(competitorName)
}

async function scrapeLinkedInAlternative(competitorName: string): Promise<ScrapedAd[]> {
  let context: BrowserContext | null = null
  let page: any = null

  try {
    context = await createStealthContext()
    page = await context.newPage()

    // Set shorter timeouts
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Use Google to find LinkedIn ads
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(`${competitorName} linkedin "sponsored" OR "promoted" OR advertising`)}`,
      {
        waitUntil: "domcontentloaded",
      },
    )

    // Wait for search results with a more reliable approach
    const hasResults = await waitForSelectorSafe(page, "#search", { timeout: 15000 })

    if (!hasResults) {
      console.log("Google search results not found for LinkedIn alternative, returning empty array")
      return []
    }

    // Extract potential ad information from Google search results
    const searchResults = await safeEvaluate(
      page,
      () => {
        const results = Array.from(document.querySelectorAll(".g"))

        return results.slice(0, 8).map((result) => {
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
      },
      [],
    )

    // Filter results to only include relevant LinkedIn ad content
    return searchResults.filter(
      (ad: ScrapedAd) =>
        (ad.content.toLowerCase().includes("linkedin") ||
          (ad.landingPage && ad.landingPage.includes("linkedin.com"))) &&
        (ad.content.toLowerCase().includes("sponsored") ||
          ad.content.toLowerCase().includes("promoted") ||
          ad.content.toLowerCase().includes("advertising") ||
          ad.content.toLowerCase().includes("campaign")),
    ) as ScrapedAd[]
  } catch (error) {
    console.error("Error in LinkedIn alternative scraping:", error)
    return []
  } finally {
    if (page) {
      try {
        await page.close()
      } catch (e) {
        console.error("Error closing page:", e)
      }
    }
    if (context) {
      try {
        await context.close()
      } catch (e) {
        console.error("Error closing context:", e)
      }
    }
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
              aiAnalysis: { rawAnalysis: "Analysis failed" },
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