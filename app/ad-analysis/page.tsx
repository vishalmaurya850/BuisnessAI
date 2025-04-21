import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Download, Filter, ImageIcon, Search, Video } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { ads } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

export default async function AdAnalysisPage() {
  // Check if the code is running in a server environment
  if (typeof window !== "undefined") {
    return notFound(); // Prevent rendering on the client
  }

  // Fetch ads from the database
  let allAds = [];
  try {
    allAds = await db.query.ads.findMany({
      orderBy: [desc(ads.createdAt)],
    });
  } catch (error) {
    console.error("Error fetching ads:", error);
    return notFound(); // Handle database connection errors gracefully
  }

  const imageAds = allAds.filter((ad): ad is typeof ad & { type: "image" } => ad.type === "image")
  const videoAds = allAds.filter((ad): ad is typeof ad & { type: "video" } => ad.type === "video")
  const textAds = allAds.filter((ad): ad is typeof ad & { type: "text" } => ad.type === "text")

  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ad Analysis</h1>
          <p className="text-muted-foreground">Analyze and compare competitor ad campaigns</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search ads..." className="pl-8" />
        </div>
        <div className="flex gap-4">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="mb-8">
        <TabsList>
          <TabsTrigger value="all">All Ads</TabsTrigger>
          <TabsTrigger value="image">Image Ads</TabsTrigger>
          <TabsTrigger value="video">Video Ads</TabsTrigger>
          <TabsTrigger value="text">Text Ads</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {allAds
              .filter((ad): ad is typeof ad & { type: "image" | "video" | "text" } =>
                ["image", "video", "text"].includes(ad.type)
              )
              .map((ad) => (
                <AdCard
                  key={ad.id}
                  competitor={ad.competitorId.toString()}
                  platform={ad.platform}
                  type={ad.type}
                  date={new Date(ad.createdAt).toLocaleDateString()}
                />
              ))}
          </div>
        </TabsContent>
        <TabsContent value="image" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {imageAds.map((ad) => (
              <AdCard
                key={ad.id}
                competitor={ad.competitorId.toString()}
                platform={ad.platform}
                type={ad.type as "image" | "video" | "text"}
                date={new Date(ad.createdAt).toLocaleDateString()}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="video" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {videoAds.map((ad) => (
              <AdCard
                key={ad.id}
                competitor={ad.competitorId.toString()}
                platform={ad.platform}
                type={ad.type}
                date={new Date(ad.createdAt).toLocaleDateString()}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="text" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {textAds.map((ad) => (
              <AdCard
                key={ad.id}
                competitor={ad.competitorId.toString()}
                platform={ad.platform}
                type={ad.type}
                date={new Date(ad.createdAt).toLocaleDateString()}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Ad Performance Analysis</CardTitle>
          <CardDescription>Comparative analysis of competitor ad performance</CardDescription>
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
  competitor,
  platform,
  type,
  date,
}: {
  competitor: string
  platform: string
  type: "image" | "video" | "text"
  date: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{competitor}</CardTitle>
          <div className="px-2 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">{platform}</div>
        </div>
        <CardDescription>{date}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 aspect-video rounded-md bg-muted/50 flex items-center justify-center">
          {type === "image" && <ImageIcon className="h-8 w-8 text-muted-foreground" />}
          {type === "video" && <Video className="h-8 w-8 text-muted-foreground" />}
          {type === "text" && (
            <div className="text-center p-4">
              <p className="text-sm font-medium">Sample Ad Text</p>
              <p className="text-xs text-muted-foreground">Click here to learn more</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Ad Type</p>
            <p className="text-sm text-muted-foreground capitalize">{type}</p>
          </div>
          <div>
            <p className="text-sm font-medium">AI Analysis</p>
            <p className="text-sm text-muted-foreground">
              {type === "image"
                ? "Product showcase with bright colors targeting young adults"
                : type === "video"
                ? "Emotional storytelling with customer testimonials"
                : "Direct response ad with strong call-to-action"}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" className="w-full">
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}