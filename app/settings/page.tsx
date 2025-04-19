import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function SettingsPage() {
  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application preferences</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="scraping">Scraping Settings</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>Update your business information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input id="business-name" defaultValue="Your Business Name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" defaultValue="E-commerce" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" defaultValue="New York, USA" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" defaultValue="https://yourbusiness.com" />
                </div>
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the application appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <Switch id="dark-mode" defaultChecked />
                </div>
                <p className="text-sm text-muted-foreground">Enable dark mode for the application</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Color Theme</Label>
                <div className="grid grid-cols-5 gap-2">
                  {["purple", "blue", "green", "orange", "red"].map((color) => (
                    <div
                      key={color}
                      className={`h-10 rounded-md cursor-pointer border-2 ${
                        color === "purple" ? "border-primary" : "border-transparent"
                      }`}
                      style={{
                        backgroundColor:
                          color === "purple"
                            ? "hsl(262.1, 83.3%, 57.8%)"
                            : color === "blue"
                              ? "hsl(221, 83.3%, 57.8%)"
                              : color === "green"
                                ? "hsl(142.1, 76.2%, 36.3%)"
                                : color === "orange"
                                  ? "hsl(24.6, 95%, 53.1%)"
                                  : "hsl(0, 84.2%, 60.2%)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure how and when you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Email Notifications</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-new-ads">New Ad Campaigns</Label>
                    <Switch id="email-new-ads" defaultChecked />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications when competitors launch new ad campaigns
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-insights">Weekly Insights</Label>
                    <Switch id="email-insights" defaultChecked />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly email summaries of competitor activities and insights
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-reports">Monthly Reports</Label>
                    <Switch id="email-reports" defaultChecked />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive monthly detailed reports of competitor analysis
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">In-App Notifications</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="app-all-activities">All Competitor Activities</Label>
                    <Switch id="app-all-activities" defaultChecked />
                  </div>
                  <p className="text-sm text-muted-foreground">Receive notifications for all competitor activities</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="app-important">Important Activities Only</Label>
                    <Switch id="app-important" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Only receive notifications for important competitor activities
                  </p>
                </div>
              </div>

              <Button>Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scraping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scraping Configuration</CardTitle>
              <CardDescription>Configure how the system scrapes competitor data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Scraping Frequency</h3>
                <div className="space-y-2">
                  <Label>Check for new ads every:</Label>
                  <Select defaultValue="6">
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 hours</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="12">12 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Platforms to Monitor</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="platform-facebook">Facebook Ads</Label>
                    <Switch id="platform-facebook" defaultChecked />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="platform-google">Google Ads</Label>
                    <Switch id="platform-google" defaultChecked />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="platform-instagram">Instagram</Label>
                    <Switch id="platform-instagram" defaultChecked />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="platform-linkedin">LinkedIn</Label>
                    <Switch id="platform-linkedin" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="platform-twitter">Twitter</Label>
                    <Switch id="platform-twitter" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Data Retention</h3>
                <div className="space-y-2">
                  <Label>Keep historical data for:</Label>
                  <Select defaultValue="90">
                    <SelectTrigger>
                      <SelectValue placeholder="Select retention period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button>Save Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Integration</CardTitle>
              <CardDescription>Manage API keys for third-party services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">AI Services</h3>
                <div className="space-y-2">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <div className="flex gap-2">
                    <Input id="openai-key" type="password" value="sk-••••••••••••••••••••••••" />
                    <Button variant="outline">Update</Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Used for AI analysis of ad content and generating insights
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Ad Platforms</h3>
                <div className="space-y-2">
                  <Label htmlFor="facebook-key">Facebook Ad Library API Key</Label>
                  <div className="flex gap-2">
                    <Input id="facebook-key" type="password" value="fb-••••••••••••••••••••••••" />
                    <Button variant="outline">Update</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google-key">Google Ads API Key</Label>
                  <div className="flex gap-2">
                    <Input id="google-key" type="password" value="goog-••••••••••••••••••••••••" />
                    <Button variant="outline">Update</Button>
                  </div>
                </div>
              </div>

              <Button>Save API Keys</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
