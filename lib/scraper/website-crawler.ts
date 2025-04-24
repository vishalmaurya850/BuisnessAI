import { chromium, type Browser, type BrowserContext, type Page } from "playwright"
import { db } from "@/lib/db"
import { ads, competitors } from "@/lib/db/schema"
import { analyzeAdContent } from "@/lib/ai"
import { eq, and } from "drizzle-orm"
import type { AdType, Platform, ScrapedAd } from "@/lib/types"
import { JSDOM } from "jsdom"

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
    ignoreHTTPSErrors: true, // Allow navigation to websites with invalid SSL certificates
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
    let baseUrl = ""
    try {
      // Validate and normalize the website URL
      if (!competitor.website) {
        throw new Error("Competitor website URL is empty")
      }

      // Add protocol if missing
      let websiteUrl = competitor.website
      if (!websiteUrl.startsWith("http://") && !websiteUrl.startsWith("https://")) {
        websiteUrl = "https://" + websiteUrl
      }

      const url = new URL(websiteUrl)
      baseUrl = url.origin
      urlsToVisit.push(websiteUrl)
    } catch (error) {
      console.error(`Invalid competitor website URL: ${competitor.website}`, error)
      // Use a fallback approach - just the domain without path
      if (competitor.website) {
        const domainMatch = competitor.website.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/)
        if (domainMatch) {
          baseUrl = `https://${domainMatch[1]}`
          urlsToVisit.push(baseUrl)
        } else {
          throw new Error(`Cannot parse website URL: ${competitor.website}`)
        }
      } else {
        throw new Error("Competitor website URL is empty")
      }
    }

    // Crawl pages until we've visited the maximum number or run out of URLs
    while (urlsToVisit.length > 0 && visitedUrls.size < maxPages) {
      const currentUrl = urlsToVisit.shift()
      if (!currentUrl || visitedUrls.has(currentUrl)) continue

      console.log(`Crawling: ${currentUrl}`)
      visitedUrls.add(currentUrl)

      try {
        // Navigate to the page with error handling
          try {
            await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
            await page.waitForSelector("body", { timeout: 10000 }); // Ensure the page is fully loaded
          } catch (error) {
            console.error(`Failed to navigate to ${currentUrl}:`, error);
            continue; // Skip to the next URL
          }

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
        try {
          // Extract ad content safely
          const pageContent = await page.content()
          const pageUrl = page.url()

          // Process the page content to find ads
          const pageAds = await extractAdsFromPageContent(pageContent, pageUrl, competitor.name)
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
                try {
                  fullUrl = new URL(link, currentUrl).href
                } catch (e) {
                  continue // Skip invalid URLs
                }
              }

              // Only add URLs from the same domain
              try {
                const linkUrl = new URL(fullUrl)
                if (
                  linkUrl.hostname === new URL(baseUrl).hostname &&
                  !visitedUrls.has(fullUrl) &&
                  !urlsToVisit.includes(fullUrl)
                ) {
                  urlsToVisit.push(fullUrl)
                }
              } catch (e) {
                continue // Skip invalid URLs
              }
            } catch (error) {
              // Skip invalid URLs
              continue
            }
          }
        } catch (error) {
          console.error(`Error processing page ${currentUrl}:`, error)
          // Continue with the next URL
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
 * Extracts ad content from HTML content
 * This is a safer approach that doesn't rely on element handles
 */
async function extractAdsFromPageContent(html: string, pageUrl: string, competitorName: string): Promise<ScrapedAd[]> {
  const ads: ScrapedAd[] = []

  try {
    // Create a DOM parser
    const dom = new JSDOM(html);
    const doc = dom.window.document;

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
    ];

    // Find elements matching ad selectors
    adSelectors.forEach((selector) => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((element) => {
      const adContent = element.textContent?.trim();
      if (adContent) {
        ads.push({
        type: "text" as AdType,
        content: adContent,
        mediaUrl: "",
        landingPage: pageUrl,
        firstSeen: new Date().toISOString(),
        isActive: true,
        });
      }
      });
    });

    // Extract text content from HTML
    const bodyText = doc.body.textContent || ""
    const paragraphs = bodyText.split("\n").filter((p) => p.trim().length > 20)

    // Look for paragraphs with ad keywords
    for (const paragraph of paragraphs) {
      // Check if paragraph contains multiple ad keywords
      const keywordMatches = AD_KEYWORDS.filter((keyword) => paragraph.toLowerCase().includes(keyword))
      if (keywordMatches.length >= 2) {
        // This paragraph likely contains ad content
        ads.push({
          type: "text",
          content: paragraph.trim(),
          mediaUrl: "",
          landingPage: pageUrl,
          firstSeen: new Date().toISOString(),
          isActive: true,
        })
      }
    }

    return ads
  } catch (error) {
    console.error("Error extracting ads from page content:", error)
    return ads
  }
}

/**
 * Extracts ad content from a page
 * This is kept for reference but not used directly anymore
 */
export async function extractAdsFromPage(page: Page, competitorName: string): Promise<ScrapedAd[]> {
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

    // Get the page content instead of working with elements
    const content = await page.content()
    const pageUrl = page.url()

    // Use the safer method
    return await extractAdsFromPageContent(content, pageUrl, competitorName)
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
  userId: string, // Add userId parameter
): Promise<{ added: number; updated: number; errors: number }> {
  const results = {
    added: 0,
    updated: 0,
    errors: 0,
  }

  try {
    // Get existing ads for this competitor
    const existingAds = await db.query.ads.findMany({
      where: and(
        eq(ads.competitorId, competitorId),
        eq(ads.userId, userId), // Filter by userId
      ),
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
            .where(
              and(
                eq(ads.id, existingAd.id),
                eq(ads.userId, userId), // Ensure user owns the ad
              ),
            )

          results.updated++
        } else {
          // This is a new ad, analyze it with AI
          try {
            const aiAnalysis = await analyzeAdContent(adData.content, adData.type as AdType)

            // Insert the new ad
            await db.insert(ads).values({
              userId, // Add user ID to link directly to the user
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
              userId, // Add user ID to link directly to the user
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