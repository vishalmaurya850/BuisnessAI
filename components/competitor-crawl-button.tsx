"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Globe, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"

export function CompetitorCrawlButton({ competitorId }: { competitorId: number }) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const { toast } = useToast()

  const handleCrawl = async () => {
    setIsLoading(true)
    setProgress(10)

    try {
      const response = await fetch(`/api/competitors/${competitorId}/crawl`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to crawl competitor website")
      }

      setProgress(100)
      const data = await response.json()

      toast({
        title: "Website crawl completed",
        description: `Found ${data.results.adsFound} ads, added ${data.results.adsAdded} new ads.`,
      })

      // Refresh the page to show new data
      window.location.reload()
    } catch (error) {
      console.error("Error crawling competitor website:", error)
      setProgress(0)
      toast({
        title: "Crawling failed",
        description: "Failed to crawl competitor website. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleCrawl} disabled={isLoading} size="sm" variant="outline">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Crawling...
          </>
        ) : (
          <>
            <Globe className="mr-2 h-4 w-4" />
            Crawl Website
          </>
        )}
      </Button>

      {isLoading && (
        <div className="w-full">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-center">{Math.round(progress)}%</p>
        </div>
      )}
    </div>
  )
}