"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { useState } from "react"
import { Loader2 } from "lucide-react"

const businessFormSchema = z.object({
  businessName: z.string().min(2, {
    message: "Business name must be at least 2 characters.",
  }),
  industry: z.string().min(2, {
    message: "Industry must be at least 2 characters.",
  }),
  location: z.string().optional(),
  keywords: z.string().min(5, {
    message: "Please enter some keywords related to your business.",
  }),
  knownCompetitors: z.string().optional(),
})

type BusinessFormValues = z.infer<typeof businessFormSchema>

interface BusinessSetupFormProps {
  onSuccess?: () => void
}

export function BusinessSetupForm({ onSuccess }: BusinessSetupFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: {
      businessName: "",
      industry: "",
      location: "",
      keywords: "",
      knownCompetitors: "",
    },
  })

  async function onSubmit(data: BusinessFormValues) {
    setIsSubmitting(true)

    try {
      // Submit data to the API
      const response = await fetch("/api/business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create business profile")
      }

      toast({
        title: "Business profile created",
        description: "Your business profile has been set up successfully.",
      })

      // Call the success callback if provided
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: (error as Error).message || "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Name</FormLabel>
              <FormControl>
                <Input placeholder="Your Business Name" {...field} />
              </FormControl>
              <FormDescription>The name of your business or organization.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="industry"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Industry / Niche</FormLabel>
              <FormControl>
                <Input placeholder="e.g., E-commerce, SaaS, Healthcare" {...field} />
              </FormControl>
              <FormDescription>The industry or niche your business operates in.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., New York, USA" {...field} />
              </FormControl>
              <FormDescription>The primary location of your business operations.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="keywords"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Keywords / Services / Products</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter keywords related to your business, separated by commas"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>Keywords that describe your products, services, or business focus.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="knownCompetitors"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Known Competitors (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter names of competitors you already know, separated by commas"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>List any competitors you&apos;re already aware of.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting up...
            </>
          ) : (
            "Set Up Business Profile"
          )}
        </Button>
      </form>
    </Form>
  )
}
