"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"

export function CompetitorScrapeButton({ competitorId }: { competitorId: number }) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [, setJobId] = useState<string | null>(null)
  const { toast } = useToast()

  // Check if there's an active scraping job on mount
  useEffect(() => {
    const checkScrapeStatus = async () => {
      try {
        const response = await fetch(`/api/competitors/${competitorId}/scrape`)

        if (response.ok) {
          const data = await response.json()

          if (data.status === "in_progress") {
            setIsLoading(true)
            setJobId(data.jobId)
            setProgress(data.progress || 0)

            // Start polling for updates
            startPolling()
          }
        }
      } catch (error) {
        console.error("Error checking scrape status:", error)
      }
    }

    checkScrapeStatus()
  }, [competitorId])

  // Polling function to check job status
  const startPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/competitors/${competitorId}/scrape`)

        if (response.ok) {
          const data = await response.json()

          if (data.status === "in_progress") {
            setProgress(data.progress || 0)
          } else {
            // Job completed
            clearInterval(pollInterval)
            setIsLoading(false)
            setJobId(null)
            setProgress(0)

            toast({
              title: "Scraping completed",
              description: `Successfully scraped data for competitor.`,
            })

            // Refresh the page to show new data
            window.location.reload()
          }
        }
      } catch (error) {
        console.error("Error polling scrape status:", error)
      }
    }, 5000) // Poll every 5 seconds

    // Clean up interval on unmount
    return () => clearInterval(pollInterval)
  }

  const handleScrape = async () => {
    setIsLoading(true)
    setProgress(0)

    try {
      const response = await fetch(`/api/competitors/${competitorId}/scrape`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to scrape competitor data")
      }

      const data = await response.json()

      if (data.jobId) {
        setJobId(data.jobId)
        toast({
          title: "Scraping started",
          description: "Scraping has been scheduled and will run in the background.",
        })

        // Start polling for updates
        startPolling()
      } else {
        // Handle case where job was not created
        setIsLoading(false)
        toast({
          title: "Scraping failed",
          description: "Failed to schedule scraping job.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error scraping competitor:", error)
      setIsLoading(false)
      toast({
        title: "Scraping failed",
        description: "Failed to scrape competitor data. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex flex-col gap-2">
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

      {isLoading && (
        <div className="w-full">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-center">{Math.round(progress)}%</p>
        </div>
      )}
    </div>
  )
}
