"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function CompetitorScrapeButton({ competitorId }: { competitorId: number }) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleScrape = async () => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/competitors/${competitorId}/scrape`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to scrape competitor data")
      }

      const data = await response.json()
      console.log("Scraping result:", data)

      toast({
        title: "Scraping completed",
        description: `Successfully scraped data for competitor.`,
      })

      // Refresh the page to show new data
      window.location.reload()
    } catch (error) {
      console.error("Error scraping competitor:", error)
      toast({
        title: "Scraping failed",
        description: "Failed to scrape competitor data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleScrape} disabled={isLoading} size="sm">
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Scraping...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Scrape Now
        </>
      )}
    </Button>
  )
}
