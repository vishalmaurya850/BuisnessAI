import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"

export default function CompetitorsPage() {
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
            {Array.from({ length: 6 }).map((_, i) => (
              <CompetitorCard
                key={i}
                name={`Competitor ${String.fromCharCode(65 + i)}`}
                industry="E-commerce"
                activeAds={10 - i}
                lastActivity="2 hours ago"
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="active" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CompetitorCard
                key={i}
                name={`Competitor ${String.fromCharCode(65 + i)}`}
                industry="E-commerce"
                activeAds={10 - i}
                lastActivity={`${i + 1} hours ago`}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="recent" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <CompetitorCard
                key={i}
                name={`Competitor ${String.fromCharCode(70 + i)}`}
                industry="SaaS"
                activeAds={3 - i}
                lastActivity="1 day ago"
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CompetitorCard({
  name,
  industry,
  activeAds,
  lastActivity,
}: {
  name: string
  industry: string
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
              <Link href={`/competitors/${name.toLowerCase().replace(/\s+/g, "-")}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        <CardDescription>{industry}</CardDescription>
      </CardHeader>
      <CardContent>
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
          <Link href={`/competitors/${name.toLowerCase().replace(/\s+/g, "-")}`}>
            <Button variant="outline" className="w-full">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
