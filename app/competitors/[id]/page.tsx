import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, BarChart3, ExternalLink, ImageIcon, Video } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { competitors, ads } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { notFound } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { CompetitorScrapeButton } from "@/components/competitor-scrape-button"
import { CompetitorCrawlButton } from "@/components/competitor-crawl-button"
import { DeleteCompetitorDialog } from "@/components/competitors/delete-competitor-dialog"
import { auth } from "@clerk/nextjs/server"
import { getActiveAdsCount } from "@/lib/competitors/stats"

export default async function CompetitorDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { userId } = await auth()

  if (!userId) {
    return <div>Unauthorized. Please sign in.</div>
  }

  // Await the params object
  const { id } = await params;
  const competitorId = Number.parseInt(id);
  
  if (isNaN(competitorId) || competitorId <= 0) {
    notFound()
  }

  // Get competitor details
  const competitor = await db.query.competitors.findFirst({
    where: and(eq(competitors.id, competitorId), eq(competitors.userId, userId)),
  })

  if (!competitor) {
    notFound()
  }

  // Get competitor ads
  const competitorAds = await db.query.ads.findMany({
    where: and(eq(ads.competitorId, competitorId), eq(ads.userId, userId)),
    orderBy: [desc(ads.firstSeen)],
    limit: 50,
  })

  // Count ads by platform
  const adsByPlatform: Record<string, number> = {}
  competitorAds.forEach((ad) => {
    adsByPlatform[ad.platform] = (adsByPlatform[ad.platform] || 0) + 1
  })

  // Count ads by type
  const adsByType: Record<string, number> = {}
  competitorAds.forEach((ad) => {
    adsByType[ad.type] = (adsByType[ad.type] || 0) + 1
  })

  // Get active ads count
  const activeAdsCount = await getActiveAdsCount(competitorId, userId)

  // Get latest ad
  const latestAd = competitorAds.length > 0 ? competitorAds[0] : null

  return (
    <div className="container py-10">
      <div className="mb-8">
        <Link href="/competitors" className="flex items-center text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Competitors
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{competitor.name}</h1>
            <p className="text-muted-foreground">{competitor.industry}</p>
            {competitor.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{competitor.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href={competitor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                Website
              </a>
            </Button>
            <CompetitorScrapeButton competitorId={competitor.id} />
            <CompetitorCrawlButton competitorId={competitor.id} />
            <DeleteCompetitorDialog competitorId={competitor.id} competitorName={competitor.name} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Ads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competitorAds.length}</div>
            <p className="text-xs text-muted-foreground">Across all platforms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Ads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAdsCount}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(adsByPlatform).length}</div>
            <p className="text-xs text-muted-foreground">Ad platforms used</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Latest Ad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestAd ? new Date(latestAd.firstSeen).toLocaleDateString() : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Most recent campaign</p>
          </CardContent>
        </Card>
      </div>

      {competitor.products && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Products & Services</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{competitor.products}</p>
          </CardContent>
        </Card>
      )}

      {competitor.targetAudience && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Target Audience</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{competitor.targetAudience}</p>
          </CardContent>
        </Card>
      )}

      {competitor.uniqueSellingProposition && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Unique Selling Proposition</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{competitor.uniqueSellingProposition}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="mb-8">
        <TabsList>
          <TabsTrigger value="all">All Ads</TabsTrigger>
          {Object.keys(adsByPlatform).map((platform) => (
            <TabsTrigger key={platform} value={platform}>
              {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="all" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {competitorAds.length > 0 ? (
              competitorAds
                .filter((ad) => ["image", "video", "text"].includes(ad.type))
                .map((ad) => (
                  <AdCard
                    key={ad.id}
                    ad={{
                      ...ad,
                      firstSeen: ad.firstSeen.toISOString(),
                      mediaUrl: ad.mediaUrl !== null ? ad.mediaUrl : undefined,
                      type: ad.type === "image" || ad.type === "video" || ad.type === "text" ? ad.type : "text",
                      aiAnalysis: ad.aiAnalysis as {
                        emotion?: string
                        tone?: string
                        message?: string
                        rawAnalysis?: string
                      } | undefined,
                      landingPage: ad.landingPage ?? undefined,
                    }}
                    competitorName={competitor.name}
                  />
                ))
            ) : (
              <div className="col-span-3 text-center py-10">
                <p className="text-muted-foreground">No ads found for this competitor.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click "Scrape Now" or "Crawl Website" to fetch the latest ads.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
        {Object.keys(adsByPlatform).map((platform) => (
          <TabsContent key={platform} value={platform} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {competitorAds
                .filter((ad) => ad.platform === platform)
                .map((ad) => (
                  <AdCard
                    key={ad.id}
                    ad={{
                      ...ad,
                      firstSeen: ad.firstSeen.toISOString(),
                      mediaUrl: ad.mediaUrl !== null ? ad.mediaUrl : undefined,
                      type: ad.type === "image" || ad.type === "video" || ad.type === "text" ? ad.type : "text",
                      aiAnalysis: ad.aiAnalysis as {
                        emotion?: string
                        tone?: string
                        message?: string
                        rawAnalysis?: string
                      } | undefined,
                      landingPage: ad.landingPage ?? undefined,
                    }}
                    competitorName={competitor.name}
                  />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Ad Performance Analysis</CardTitle>
          <CardDescription>Comparative analysis of ad performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center border rounded-md bg-muted/30">
            <div className="text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Performance chart will appear here</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AdCard({
  ad,
  competitorName,
}: {
  ad: {
    id: number
    platform: string
    firstSeen: string
    mediaUrl?: string
    type: "image" | "video" | "text"
    content: string
    isActive: boolean
    aiAnalysis?: {
      emotion?: string
      tone?: string
      message?: string
      rawAnalysis?: string
    }
    landingPage?: string
  }
  competitorName: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{competitorName}</CardTitle>
          <div className="px-2 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary capitalize">
            {ad.platform}
          </div>
        </div>
        <CardDescription>{new Date(ad.firstSeen).toLocaleDateString()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 aspect-video rounded-md bg-muted/50 flex items-center justify-center">
          {ad.mediaUrl ? (
            ad.type === "image" ? (
              <img
                src={ad.mediaUrl || "/placeholder.svg"}
                alt="Ad content"
                className="h-full w-full object-cover rounded-md"
              />
            ) : ad.type === "video" ? (
              <video src={ad.mediaUrl} controls className="h-full w-full object-cover rounded-md" />
            ) : (
              <div className="text-center p-4">
                <p className="text-sm font-medium">{ad.content.substring(0, 50)}...</p>
              </div>
            )
          ) : (
            <>
              {ad.type === "image" && <ImageIcon className="h-8 w-8 text-muted-foreground" />}
              {ad.type === "video" && <Video className="h-8 w-8 text-muted-foreground" />}
              {ad.type === "text" && (
                <div className="text-center p-4">
                  <p className="text-sm font-medium">{ad.content.substring(0, 50)}...</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Ad Type</p>
            <p className="text-sm text-muted-foreground capitalize">{ad.type}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Status</p>
            <Badge variant={ad.isActive ? "default" : "secondary"}>{ad.isActive ? "Active" : "Inactive"}</Badge>
          </div>
          {ad.aiAnalysis && (
            <div>
              <p className="text-sm font-medium">AI Analysis</p>
              <p className="text-sm text-muted-foreground">
                {ad.aiAnalysis.emotion ||
                  ad.aiAnalysis.tone ||
                  ad.aiAnalysis.message ||
                  ad.aiAnalysis.rawAnalysis?.substring(0, 100) ||
                  "No analysis available"}
              </p>
            </div>
          )}
        </div>
        <Separator className="my-4" />
        <div className="text-sm">
          <p className="font-medium">Ad Content:</p>
          <p className="text-muted-foreground mt-1">
            {ad.content.substring(0, 150)}
            {ad.content.length > 150 ? "..." : ""}
          </p>
        </div>
        {ad.landingPage && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full" asChild>
              <a href={ad.landingPage} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                <ExternalLink className="h-4 w-4" />
                Visit Landing Page
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
