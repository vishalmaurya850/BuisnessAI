"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { BusinessSetupForm } from "@/components/business-setup-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";

export default function OnboardingPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("welcome");
  const [businessCreated, setBusinessCreated] = useState(false);
  const [competitorsDiscovered, setCompetitorsDiscovered] = useState(false);
  const [initialScrapeComplete, setInitialScrapeComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScraping, setIsScraping] = useState(false); // New state for scraping

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
      return;
    }

    // Check if user already has a business
    async function checkBusiness() {
      if (!isSignedIn) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/business");

        if (!response.ok) {
          throw new Error("Failed to check business status");
        }

        const data = await response.json();

        if (data.exists) {
          // User already has a business, redirect to dashboard
          router.push("/dashboard");
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error checking business:", error);
        setError("Failed to check your business status. Please try refreshing the page.");
        toast({
          title: "Error",
          description: "Failed to check your business status. Please try refreshing the page.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    }

    checkBusiness();
  }, [isLoaded, isSignedIn, router]);

  const handleBusinessCreated = () => {
    setBusinessCreated(true);
    setActiveTab("discover");
    setProgress(33);

    // Start competitor discovery
    discoverCompetitors();
  };

  const discoverCompetitors = async () => {
    try {
      // Call the competitor discovery API
      const response = await fetch("/api/competitors/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // The API will get the business ID from the auth context
      });

      if (!response.ok) {
        throw new Error("Failed to discover competitors");
      }


      setCompetitorsDiscovered(true);
      setActiveTab("scrape");
      setProgress(66);

      // Now trigger initial scraping
      await initiateInitialScrape();
    } catch (error) {
      console.error("Error discovering competitors:", error);
      toast({
        title: "Error",
        description: "Failed to discover competitors. Please try again.",
        variant: "destructive",
      });
    }
  };

  const initiateInitialScrape = async () => {
    try {
      setIsScraping(true); // Set scraping state to true

      // Get competitors first
      const competitorsResponse = await fetch("/api/competitors");

      if (!competitorsResponse.ok) {
        throw new Error("Failed to fetch competitors");
      }

      const competitorsData = await competitorsResponse.json();

      // Trigger scraping for each competitor
      const scrapePromises = competitorsData.map((competitor: { id: string }) =>
        fetch(`/api/competitors/${competitor.id}/scrape`, {
          method: "POST",
        }),
      );

      // Wait for all scraping to complete
      await Promise.allSettled(scrapePromises);

      setInitialScrapeComplete(true);
      setProgress(100);
    } catch (error) {
      console.error("Error during initial scrape:", error);
      // Even if scraping fails, we'll consider setup complete
      setInitialScrapeComplete(true);
      setProgress(100);
      toast({
        title: "Warning",
        description: "Initial data scraping encountered some issues, but you can still proceed to the dashboard.",
        variant: "default",
      });
    } finally {
      setIsScraping(false); // Set scraping state to false
    }
  };

  const goToDashboard = () => {
    router.push("/dashboard");
  };

  if (!isLoaded || (isLoading && isSignedIn)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl py-10">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Error</CardTitle>
            </div>
            <CardDescription>We encountered an error while setting up your account</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Welcome to CompetitorAI</h1>
        <p className="text-muted-foreground">Let&apos;s get your account set up in just a few steps.</p>
      </div>

      <Progress value={progress} className="mb-8" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid grid-cols-3 mb-8">
          <TabsTrigger value="welcome" disabled={activeTab !== "welcome"}>
            1. Business Setup
          </TabsTrigger>
          <TabsTrigger value="discover" disabled={!businessCreated}>
            2. Competitor Discovery
          </TabsTrigger>
          <TabsTrigger value="scrape" disabled={!competitorsDiscovered}>
            3. Initial Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="welcome">
          <Card>
            <CardHeader>
              <CardTitle>Set Up Your Business Profile</CardTitle>
              <CardDescription>
                Provide details about your business to help us identify relevant competitors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessSetupForm onSuccess={handleBusinessCreated} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discover">
          <Card>
            <CardHeader>
              <CardTitle>Discovering Competitors</CardTitle>
              <CardDescription>
                We&apos;re using AI to identify relevant competitors based on your business information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10">
                {competitorsDiscovered ? (
                  <div className="text-center">
                    <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-medium mb-2">Competitors Discovered!</h3>
                    <p className="text-muted-foreground mb-6">
                      We&apos;ve identified relevant competitors in your industry.
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-medium mb-2">Discovering Competitors...</h3>
                    <p className="text-muted-foreground">
                      This may take a moment as we search for relevant competitors in your industry.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scrape">
          <Card>
            <CardHeader>
              <CardTitle>Initial Analysis</CardTitle>
              <CardDescription>
                We&apos;re gathering and analyzing data from your competitors marketing activities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10">
                {isScraping ? ( // Show loading spinner while scraping
                  <div className="text-center">
                    <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-medium mb-2">Analyzing Competitor Data...</h3>
                    <p className="text-muted-foreground">
                      We&apos;re gathering information about your competitors ads, campaigns, and marketing strategies.
                    </p>
                  </div>
                ) : initialScrapeComplete ? (
                  <div className="text-center">
                    <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-medium mb-2">Setup Complete!</h3>
                    <p className="text-muted-foreground mb-6">
                      Your account is now set up and ready to use. We&apos;ll continue monitoring your competitors in the
                      background.
                    </p>
                    <Button onClick={goToDashboard} className="gap-2">
                      Go to Dashboard <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-medium mb-2">Analyzing Competitor Data...</h3>
                    <p className="text-muted-foreground">
                      We&apos;re gathering information about your competitors ads, campaigns, and marketing strategies.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}