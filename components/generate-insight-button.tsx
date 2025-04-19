"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

export function GenerateInsightButton() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleGenerateInsight = async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ generate: true }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate insight")
      }

      const data = await response.json()
      console.log("Insight generated:", data)

      toast({
        title: "Insight generated",
        description: "New AI-powered insight has been created.",
      })

      // Refresh the page to show new insight
      router.refresh()
    } catch (error) {
      console.error("Error generating insight:", error)
      toast({
        title: "Generation failed",
        description: "Failed to generate insight. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleGenerateInsight} disabled={isLoading} size="sm">
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Insight
        </>
      )}
    </Button>
  )
}
