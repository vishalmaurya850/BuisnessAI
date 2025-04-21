import { chromium, type Browser, type BrowserContext, type Page } from "playwright"
import { db } from "@/lib/db"
import { ads, competitors } from "@/lib/db/schema"
import { analyzeAdContent } from "@/lib/ai"
import { eq } from "drizzle-orm"
import type { AdType, Platform, ScrapedAd } from "@/lib/types"

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
  const browser = await getBrowser();

  // Rotate user agents to avoid detection
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  ];

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

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
    ignoreHTTPSErrors: true, // Allow navigation to websites with invalid SSL certificates
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "sec-ch-ua": '"Chromium";v="123", "Google Chrome";v="123"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  });
}

// Safe page evaluation that handles errors
async function safeEvaluate<T>(page: Page, fn: () => T, defaultValue: T): Promise<T> {
  try {
    return await page.evaluate(fn)
  } catch (error) {
    console.error("Error during page evaluation:", error)
    return defaultValue
  }
}

// Wait for selector safely
async function waitForSelectorSafe(page: Page, selector: string, options: { timeout: number }): Promise<boolean> {
  try {
    await page.waitForSelector(selector, options)
    return true
  } catch {
    return false
  }
}

// Keywords that indicate ad content
const AD_KEYWORDS = [
  "advertisement",
  "sponsored",
  "promotion",
  "ad",
  "campaign",
  "offer",
  "discount",
  "limited time",
  "special offer",
  "deal",
  "promo",
  "sale",
  "buy now",
  "shop now",
  "learn more",
  "click here",
  "banner",
]

// Keywords that indicate sections to avoid
const AVOID_KEYWORDS = [
  "login",
  "sign in",
  "register",
  "account",
  "password",
  "privacy policy",
  "terms of service",
  "cookie policy",
  "sitemap",
]

/**
 * Crawls a competitor's website to find ad content
 */
export async function crawlCompetitorWebsite(competitorId: number, maxPages = 10): Promise<ScrapedAd[]> {
  let context: BrowserContext | null = null
  let page: Page | null = null
  const scrapedAds: ScrapedAd[] = []
  const visitedUrls = new Set<string>()
  const urlsToVisit: string[] = []

  try {
    // Get competitor details
    const competitor = await db.query.competitors.findFirst({
      where: eq(competitors.id, competitorId),
    })

    if (!competitor) {
      throw new Error(`Competitor with ID ${competitorId} not found`)
    }

    console.log(`Starting website crawl for competitor: ${competitor.name} (${competitor.website})`)

    // Initialize browser
    context = await createStealthContext()
    page = await context.newPage()
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)

    // Start with the competitor's website
    const baseUrl = new URL(competitor.website).origin
    urlsToVisit.push(competitor.website)

    // Crawl pages until we've visited the maximum number or run out of URLs
    while (urlsToVisit.length > 0 && visitedUrls.size < maxPages) {
      const currentUrl = urlsToVisit.shift()
      if (!currentUrl || visitedUrls.has(currentUrl)) continue

      console.log(`Crawling: ${currentUrl}`)
      visitedUrls.add(currentUrl)

      try {
        // Navigate to the page
        if (currentUrl.startsWith("https://")) {
          console.warn(`Navigating to ${currentUrl} with invalid SSL certificate.`);
        }
        await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 30000 })

        // Wait for the page to load more completely
        await page.waitForTimeout(2000)

        // Handle cookie consent if it appears
        const cookieSelectors = [
          'button[id*="cookie"][id*="accept"]',
          'button[class*="cookie"][class*="accept"]',
          'button[id*="consent"][id*="accept"]',
          'button[class*="consent"][class*="accept"]',
          'button:has-text("Accept")',
          'button:has-text("Accept All")',
          'button:has-text("I Accept")',
          'button:has-text("OK")',
        ]

        for (const selector of cookieSelectors) {
          const hasCookieButton = await waitForSelectorSafe(page, selector, { timeout: 2000 })
          if (hasCookieButton) {
            await page.click(selector)
            break
          }
        }

        // Extract ad content from the current page
        const pageAds = await extractAdsFromPage(page, competitor.name)
        scrapedAds.push(...pageAds)

        // Find links to other pages on the same domain
        const links = await safeEvaluate(
          page,
          () => {
            return Array.from(document.querySelectorAll("a[href]"))
              .map((a) => a.getAttribute("href"))
              .filter(Boolean) as string[]
          },
          [],
        )

        // Process and add new links to the queue
        for (const link of links) {
          try {
            // Skip if the link contains fragments to avoid
            if (AVOID_KEYWORDS.some((keyword) => link.toLowerCase().includes(keyword))) {
              continue
            }

            // Resolve relative URLs
            let fullUrl = link
            if (link.startsWith("/")) {
              fullUrl = `${baseUrl}${link}`
            } else if (!link.startsWith("http")) {
              fullUrl = new URL(link, currentUrl).href
            }

            // Only add URLs from the same domain
            const linkUrl = new URL(fullUrl)
            if (
              linkUrl.hostname === new URL(baseUrl).hostname &&
              !visitedUrls.has(fullUrl) &&
              !urlsToVisit.includes(fullUrl)
            ) {
              urlsToVisit.push(fullUrl)
            }
          } catch {
            // Skip invalid URLs
            continue
          }
        }

        // Add a small delay between page visits
        await page.waitForTimeout(1000)
      } catch (error) {
        console.error(`Error crawling ${currentUrl}:`, error)
        // Continue with the next URL
        continue
      }
    }

    console.log(
      `Crawl completed for ${competitor.name}. Visited ${visitedUrls.size} pages, found ${scrapedAds.length} ads.`,
    )
    return scrapedAds
  } catch (error) {
    console.error("Error in website crawler:", error)
    return scrapedAds
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

/**
 * Extracts ad content from a page
 */
async function extractAdsFromPage(page: Page, competitorName: string): Promise<ScrapedAd[]> {
  const ads: ScrapedAd[] = []

  try {
    // 1. Look for elements with ad-related classes or IDs
    const adSelectors = [
      '[class*="ad-"]',
      '[class*="ads-"]',
      '[class*="advert"]',
      '[class*="promo"]',
      '[class*="banner"]',
      '[class*="offer"]',
      '[class*="campaign"]',
      '[id*="ad-"]',
      '[id*="ads-"]',
      '[id*="advert"]',
      '[id*="promo"]',
      '[id*="banner"]',
      '[id*="offer"]',
      '[id*="campaign"]',
    ]

    for (const selector of adSelectors) {
      const elements = await page.$$(selector)
      for (const element of elements) {
        try {
          // Extract content
          const content = await element.evaluate((el) => el.textContent || "")
          if (!content || content.trim().length < 10) continue

          // Check if it contains ad keywords
          if (!AD_KEYWORDS.some((keyword) => content.toLowerCase().includes(keyword))) continue

          // Determine ad type
          let type: AdType = "text"
          const hasImage = await element.$("img")
          const hasVideo = await element.$("video")
          if (hasVideo) {
            type = "video"
          } else if (hasImage) {
            type = "image"
          }

          // Extract media URL
          let mediaUrl = ""
          if (type === "image") {
            const img = await element.$("img")
            if (img) {
              mediaUrl = await img.evaluate((el) => el.getAttribute("src") || "")
            }
          } else if (type === "video") {
            const video = await element.$("video")
            if (video) {
              mediaUrl = await video.evaluate((el) => el.getAttribute("src") || "")
            }
          }

          // Extract landing page
          let landingPage = ""
          const link = await element.$("a")
          if (link) {
            landingPage = await link.evaluate((el) => el.getAttribute("href") || "")
            // Resolve relative URLs
            if (landingPage.startsWith("/")) {
              landingPage = new URL(landingPage, page.url()).href
            } else if (!landingPage.startsWith("http")) {
              landingPage = new URL(landingPage, page.url()).href
            }
          }

          // Add to ads list
          ads.push({
            type,
            content: content.trim(),
            mediaUrl,
            landingPage,
            firstSeen: new Date().toISOString(),
            isActive: true,
          })
        } catch (error) {
          console.error("Error extracting ad content:", error)
          continue
        }
      }
    }

    // 2. Look for iframes that might contain ads
    const iframes = await page.$$("iframe")
    for (const iframe of iframes) {
      try {
        const src = await iframe.evaluate((el) => el.getAttribute("src") || "")
        if (
          src &&
          (src.includes("ad") ||
            src.includes("ads") ||
            src.includes("banner") ||
            src.includes("promo") ||
            src.includes("campaign"))
        ) {
          ads.push({
            type: "text",
            content: `Iframe ad from ${competitorName} - Source: ${src}`,
            mediaUrl: "",
            landingPage: src,
            firstSeen: new Date().toISOString(),
            isActive: true,
          })
        }
      } catch (error) {
        console.error("Error extracting iframe content:", error)
        continue
      }
    }

    // 3. Look for sections with ad-related text content
    const bodyText = await page.evaluate(() => document.body.innerText)
    const paragraphs = bodyText.split("\n").filter((p) => p.trim().length > 20)

    for (const paragraph of paragraphs) {
      // Check if paragraph contains multiple ad keywords
      const keywordMatches = AD_KEYWORDS.filter((keyword) => paragraph.toLowerCase().includes(keyword))
      if (keywordMatches.length >= 2) {
        // This paragraph likely contains ad content
        ads.push({
          type: "text",
          content: paragraph.trim(),
          mediaUrl: "",
          landingPage: page.url(),
          firstSeen: new Date().toISOString(),
          isActive: true,
        })
      }
    }

    return ads
  } catch (error) {
    console.error("Error extracting ads from page:", error)
    return ads
  }
}

/**
 * Analyzes and processes scraped ads
 */
export async function processScrapedWebsiteAds(
  competitorId: number,
  scrapedAds: ScrapedAd[],
): Promise<{ added: number; updated: number; errors: number }> {
  const results = {
    added: 0,
    updated: 0,
    errors: 0,
  }

  try {
    // Get existing ads for this competitor
    const existingAds = await db.query.ads.findMany({
      where: eq(ads.competitorId, competitorId),
    })

    // Create a map of existing ad content for faster lookup
    const existingAdContentMap = new Map(existingAds.map((ad) => [ad.content, ad]))

    // Process each scraped ad
    for (const adData of scrapedAds) {
      try {
        // Skip ads with empty content
        if (!adData.content || adData.content.trim() === "") continue

        const existingAd = existingAdContentMap.get(adData.content)

        if (existingAd) {
          // Update existing ad
          await db
            .update(ads)
            .set({
              isActive: true,
              lastSeen: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(ads.id, existingAd.id))

          results.updated++
        } else {
          // This is a new ad, analyze it with AI
          try {
            const aiAnalysis = await analyzeAdContent(adData.content, adData.type as AdType)

            // Insert the new ad
            await db.insert(ads).values({
              competitorId,
              platform: "other" as Platform, // Website ads are categorized as "other"
              type: adData.type as AdType,
              content: adData.content,
              mediaUrl: adData.mediaUrl || null,
              landingPage: adData.landingPage || null,
              firstSeen: new Date(adData.firstSeen),
              lastSeen: new Date(),
              isActive: adData.isActive,
              aiAnalysis,
            })

            results.added++
          } catch (aiError) {
            console.error("Error analyzing ad content:", aiError)

            // Still insert the ad even if AI analysis fails
            await db.insert(ads).values({
              competitorId,
              platform: "other" as Platform,
              type: adData.type as AdType,
              content: adData.content,
              mediaUrl: adData.mediaUrl || null,
              landingPage: adData.landingPage || null,
              firstSeen: new Date(adData.firstSeen),
              lastSeen: new Date(),
              isActive: adData.isActive,
              aiAnalysis: { rawAnalysis: "Analysis failed" },
            })

            results.added++
          }
        }
      } catch (error) {
        console.error("Error processing ad:", error)
        results.errors++
      }
    }

    return results
  } catch (error) {
    console.error("Error processing scraped website ads:", error)
    return results
  }
}