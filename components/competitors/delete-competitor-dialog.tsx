"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Trash2, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

interface DeleteCompetitorDialogProps {
  competitorId: number
  competitorName: string
}

export function DeleteCompetitorDialog({ competitorId, competitorName }: DeleteCompetitorDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/competitors/${competitorId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete competitor")
      }

      toast({
        title: "Competitor deleted",
        description: `${competitorName} has been deleted successfully.`,
      })

      setIsOpen(false)

      // Refresh the page or redirect to competitors list
      router.refresh()
      router.push("/competitors")
    } catch (error) {
      console.error("Error deleting competitor:", error)
      toast({
        title: "Error",
        description: "Failed to delete competitor. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Competitor</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {competitorName}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}