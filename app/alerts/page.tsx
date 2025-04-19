import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, Check, Filter, Search, Settings } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function AlertsPage() {
  return (
    <div className="container py-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">Real-time notifications about competitor activities</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="gap-2" asChild>
            <a href="/alerts/settings">
              <Settings className="h-4 w-4" /> Alert Settings
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search alerts..." className="pl-8" />
        </div>
        <div className="flex gap-4">
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="mb-8">
        <TabsList>
          <TabsTrigger value="all">All Alerts</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="important">Important</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">New Ad Campaign Detected</CardTitle>
                </div>
                <div className="px-2 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">New</div>
              </div>
              <CardDescription>2 hours ago</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                Competitor A has launched a new Facebook ad campaign targeting mobile users.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Check className="h-4 w-4" /> Mark as Read
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">New Video Ad Detected</CardTitle>
                </div>
                <div className="px-2 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">New</div>
              </div>
              <CardDescription>5 hours ago</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                Competitor B has published a new video ad on Instagram highlighting their latest product features.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Check className="h-4 w-4" /> Mark as Read
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Google Ads Campaign Updated</CardTitle>
                </div>
              </div>
              <CardDescription>1 day ago</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                Competitor C has updated their Google Ads campaign with new keywords and ad copy.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Significant Ad Spend Increase</CardTitle>
                </div>
              </div>
              <CardDescription>2 days ago</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                Competitor A has increased their ad spend by approximately 40% across all platforms.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="unread" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">New Ad Campaign Detected</CardTitle>
                </div>
                <div className="px-2 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">New</div>
              </div>
              <CardDescription>2 hours ago</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                Competitor A has launched a new Facebook ad campaign targeting mobile users.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Check className="h-4 w-4" /> Mark as Read
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">New Video Ad Detected</CardTitle>
                </div>
                <div className="px-2 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">New</div>
              </div>
              <CardDescription>5 hours ago</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                Competitor B has published a new video ad on Instagram highlighting their latest product features.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Check className="h-4 w-4" /> Mark as Read
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="important" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Significant Ad Spend Increase</CardTitle>
                </div>
                <div className="px-2 py-1 rounded-full bg-yellow-500/10 text-xs font-medium text-yellow-500">
                  Important
                </div>
              </div>
              <CardDescription>2 days ago</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                Competitor A has increased their ad spend by approximately 40% across all platforms.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Check className="h-4 w-4" /> Mark as Read
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Alert Settings</CardTitle>
          <CardDescription>Configure your notification preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="new-campaigns">New Ad Campaigns</Label>
                <p className="text-sm text-muted-foreground">Get notified when competitors launch new campaigns</p>
              </div>
              <Switch id="new-campaigns" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ad-changes">Ad Content Changes</Label>
                <p className="text-sm text-muted-foreground">Get notified when competitors update their ad content</p>
              </div>
              <Switch id="ad-changes" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="spend-changes">Ad Spend Changes</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when competitors significantly change their ad spend
                </p>
              </div>
              <Switch id="spend-changes" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-alerts">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive alert notifications via email</p>
              </div>
              <Switch id="email-alerts" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
