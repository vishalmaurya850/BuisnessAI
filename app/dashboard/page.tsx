import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowUpRight, BarChart3, Bell, Eye, LineChart, Plus, Rocket, TrendingUp, Users } from "lucide-react"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { businesses, competitors, ads, alerts, insights } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { GenerateInsightButton } from "@/components/generate-insight-button"

export default async function DashboardPage() {
  // Get the authenticated user
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  // Check if user has set up their business
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.userId, userId),
  })

  const hasBusinessSetup = !!business

  if (!hasBusinessSetup) {
    redirect("/onboarding")
  }

  // Get competitor count
  const competitorCount = await db
    .select({ count: sql`COUNT(*)` })
    .from(competitors)

  // Get active ads count
  const activeAdsCount = await db.select({ count: sql`COUNT(*)` }).from(ads).where(eq(ads.isActive, true))

  // Get new alerts count (last 24 hours)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayString = yesterday.toISOString() // Convert Date to string

  const newAlertsCount = await db
    .select({ count: sql`COUNT(*)` })
    .from(alerts)
    .where(sql`${alerts.createdAt} > ${yesterdayString}`)

  // Get insights count
  const insightsCount = await db.select({ count: sql`COUNT(*)` }).from(insights)

  // Get top competitors
  const topCompetitors = await db.query.competitors.findMany({
    limit: 4,
  })

  // Get recent alerts
  const recentAlerts = await db.query.alerts.findMany({
    orderBy: [desc(alerts.createdAt)],
    limit: 3,
  })

  // Get recent activity
  const recentActivity = await db.query.ads.findMany({
    orderBy: [desc(ads.firstSeen)],
    limit: 5,
  })

  // Get AI insights
  const aiInsights = await db.query.insights.findMany({
    orderBy: [desc(insights.createdAt)],
    limit: 3,
  })

  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your competitors' marketing activities and get insights.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/competitors/add">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Competitor
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <DashboardCard
          title="Total Competitors"
          value={competitorCount[0]?.count?.toString() || "0"}
          description="Tracked competitors"
          icon={<Users className="h-5 w-5 text-primary" />}
        />
        <DashboardCard
          title="Active Ads"
          value={activeAdsCount[0]?.count?.toString() || "0"}
          description="Across all platforms"
          icon={<BarChart3 className="h-5 w-5 text-primary" />}
        />
        <DashboardCard
          title="New Alerts"
          value={newAlertsCount[0]?.count?.toString() || "0"}
          description="In the last 24 hours"
          icon={<Bell className="h-5 w-5 text-primary" />}
        />
        <DashboardCard
          title="Insights Generated"
          value={insightsCount[0]?.count?.toString() || "0"}
          description="AI-powered insights"
          icon={<LineChart className="h-5 w-5 text-primary" />}
        />
      </div>

      <Tabs defaultValue="overview" className="mb-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recent-activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Competitor Activity Overview</CardTitle>
              <CardDescription>Summary of your competitors' marketing activities in the last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border rounded-md bg-muted/30">
                <p className="text-muted-foreground">Activity chart will appear here</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Competitors</CardTitle>
                <CardDescription>Most active competitors based on ad frequency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topCompetitors.length > 0 ? (
                    topCompetitors.map((competitor, i) => (
                      <div key={competitor.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Eye className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{competitor.name}</p>
                            <p className="text-sm text-muted-foreground">{10 - i} active campaigns</p>
                          </div>
                        </div>
                        <Link href={`/competitors/${competitor.id}`}>
                          <Button variant="ghost" size="icon">
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No competitors added yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>New competitor activities detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentAlerts.length > 0 ? (
                    recentAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                          <Bell className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-muted-foreground">{alert.description}</p>
                          <p className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No recent alerts.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recent-activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest competitor activities detected by our system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recentActivity.length > 0 ? (
                  recentActivity.map((ad) => (
                    <div key={ad.id} className="flex gap-4 items-start border-b pb-6 last:border-0 last:pb-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          New {ad.type} ad on {ad.platform}
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          {ad.content.substring(0, 100)}
                          {ad.content.length > 100 ? "..." : ""}
                        </p>
                        <div className="flex gap-2">
                          <Link href={`/competitors/${ad.competitorId}`}>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </div>
                      <div className="ml-auto text-sm text-muted-foreground">
                        {new Date(ad.firstSeen).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No recent activity detected.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>AI-Generated Insights</CardTitle>
                <CardDescription>Strategic insights based on competitor analysis</CardDescription>
              </div>
              <GenerateInsightButton businessId={business?.id} />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {aiInsights.length > 0 ? (
                  aiInsights.map((insight) => (
                    <div key={insight.id} className="flex gap-4 items-start border-b pb-6 last:border-0 last:pb-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Rocket className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{insight.title}</p>
                        <p className="text-sm text-muted-foreground mb-1">{insight.description}</p>
                        <p className="text-sm font-medium mb-2">Recommendation: {insight.recommendation}</p>
                        <Button variant="outline" size="sm">
                          Apply Insight
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">No insights generated yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Click "Generate Insight" to create AI-powered insights.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DashboardCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}