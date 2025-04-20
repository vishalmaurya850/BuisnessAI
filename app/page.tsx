import type React from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, BarChart3, Bell, Eye, MessageSquare, Search } from "lucide-react"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function Home() {
  // Check if user is authenticated
  const { userId } = await auth()

  // If user is signed in, redirect to dashboard
  if (userId) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-background/80">
      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">CompetitorAI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 md:py-32">
          <div className="container flex flex-col items-center text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              <span className="text-primary">AI-Powered</span> Competitor Analysis
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mb-10">
              Monitor your competitors' marketing activities in real-time. Get insights on ads, campaigns, and
              strategies with our advanced AI analysis.
            </p>
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Start Monitoring <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-20 bg-muted/50">
          <div className="container">
            <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Search className="h-10 w-10 text-primary" />}
                title="Competitor Identification"
                description="Automatically identify and track your top competitors based on your business details."
              />
              <FeatureCard
                icon={<BarChart3 className="h-10 w-10 text-primary" />}
                title="Ad Campaign Analysis"
                description="Analyze competitors' ads across platforms including images, videos, and text content."
              />
              <FeatureCard
                icon={<Bell className="h-10 w-10 text-primary" />}
                title="Real-time Alerts"
                description="Get notified instantly when competitors launch new campaigns or make significant changes."
              />
              <FeatureCard
                icon={<MessageSquare className="h-10 w-10 text-primary" />}
                title="AI Chatbot Interface"
                description="Ask questions about competitor activities and get instant insights from our AI assistant."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <span className="font-semibold">CompetitorAI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CompetitorAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-lg border bg-card">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}