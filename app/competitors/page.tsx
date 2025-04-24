import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Plus, Search } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/db"
import { competitors } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { DeleteCompetitorDialog } from "@/components/competitors/delete-competitor-dialog"
import { auth } from "@clerk/nextjs/server"
import { ensureUserExists } from "@/lib/auth"
import { getActiveAdsCountForCompetitors } from "@/lib/competitors/stats"

export default async function CompetitorsPage() {
  // Get the current user ID
  const { userId } = await auth()

  if (!userId) {
    return <div>Unauthorized. Please sign in.</div>
  }

  // Ensure user exists in our database
  await ensureUserExists(userId)

  // Fetch competitors from the database for this user
  const allCompetitors = await db.query.competitors.findMany({
    where: eq(competitors.userId, userId),
    orderBy: [desc(competitors.updatedAt)],
  })

  // Get ad counts for all competitors
  const competitorIds = allCompetitors.map((c) => c.id)
  const adCounts = await getActiveAdsCountForCompetitors(competitorIds, userId)

  // Get most active competitors (those with most recent updates)
  const activeCompetitors = [...allCompetitors]
    .sort((a, b) => {
      const aDate = a.lastScraped ? new Date(a.lastScraped).getTime() : 0
      const bDate = b.lastScraped ? new Date(b.lastScraped).getTime() : 0
      return bDate - aDate
    })
    .slice(0, 3)

  // Get recently added competitors
  const recentCompetitors = [...allCompetitors]
    .sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, 3)

  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Competitors</h1>
          <p className="text-muted-foreground">Manage and monitor your competitors</p>
        </div>
        <div className="flex gap-4">
          <Link href="/competitors/add">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Competitor
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search competitors..." className="pl-8" />
        </div>
      </div>

      <Tabs defaultValue="all" className="mb-8">
        <TabsList>
          <TabsTrigger value="all">All Competitors</TabsTrigger>
          <TabsTrigger value="active">Most Active</TabsTrigger>
          <TabsTrigger value="recent">Recently Added</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {allCompetitors.length > 0 ? (
              allCompetitors.map((competitor) => (
                <CompetitorCard
                  key={competitor.id}
                  id={competitor.id}
                  name={competitor.name}
                  industry={competitor.industry}
                  description={competitor.description || `A competitor in the ${competitor.industry} industry.`}
                  activeAds={adCounts.get(competitor.id) || 0}
                  lastActivity={
                    competitor.lastScraped ? new Date(competitor.lastScraped).toLocaleDateString() : "Never"
                  }
                />
              ))
            ) : (
              <div className="col-span-3 text-center py-10">
                <p className="text-muted-foreground">No competitors found.</p>
                <p className="text-sm text-muted-foreground mt-2">Add your first competitor to get started.</p>
                <Link href="/competitors/add" className="mt-4 inline-block">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Add Competitor
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="active" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeCompetitors.length > 0 ? (
              activeCompetitors.map((competitor) => (
                <CompetitorCard
                  key={competitor.id}
                  id={competitor.id}
                  name={competitor.name}
                  industry={competitor.industry}
                  description={competitor.description || `A competitor in the ${competitor.industry} industry.`}
                  activeAds={adCounts.get(competitor.id) || 0}
                  lastActivity={
                    competitor.lastScraped ? new Date(competitor.lastScraped).toLocaleDateString() : "Never"
                  }
                />
              ))
            ) : (
              <div className="col-span-3 text-center py-10">
                <p className="text-muted-foreground">No active competitors found.</p>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="recent" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recentCompetitors.length > 0 ? (
              recentCompetitors.map((competitor) => (
                <CompetitorCard
                  key={competitor.id}
                  id={competitor.id}
                  name={competitor.name}
                  industry={competitor.industry}
                  description={competitor.description || `A competitor in the ${competitor.industry} industry.`}
                  activeAds={adCounts.get(competitor.id) || 0}
                  lastActivity={
                    competitor.lastScraped ? new Date(competitor.lastScraped).toLocaleDateString() : "Never"
                  }
                />
              ))
            ) : (
              <div className="col-span-3 text-center py-10">
                <p className="text-muted-foreground">No recently added competitors found.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CompetitorCard({
  id,
  name,
  industry,
  description,
  activeAds,
  lastActivity,
}: {
  id: number
  name: string
  industry: string
  description: string
  activeAds: number
  lastActivity: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle>{name}</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/competitors/${id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <DeleteCompetitorDialog competitorId={id} competitorName={name} />
          </div>
        </div>
        <CardDescription>{industry}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{description}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Active Ads</p>
            <p className="text-2xl font-bold">{activeAds}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Last Activity</p>
            <p className="text-sm">{lastActivity}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <Link href={`/competitors/${id}`}>
            <Button variant="outline" className="w-full">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}