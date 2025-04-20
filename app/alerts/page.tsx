import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, Check, Filter, Search, Settings } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { db } from "@/lib/db"
import { alerts, competitors } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"

export default async function AlertsPage() {
  // Get the current user ID from auth
  const { userId } = await auth();

  if (!userId) {
    return <div>Authentication required</div>;
  }

  // Fetch alerts from database
  const alertsData = await db.query.alerts.findMany({
    where: eq(alerts.userId, userId),
    orderBy: [desc(alerts.createdAt)],
    with: {
      competitor: true
    },
    limit: 50
  });

  const allAlerts = alertsData;
  const unreadAlerts = alertsData.filter(alert => !alert.isRead);
  const importantAlerts = alertsData.filter(alert => alert.isImportant);

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
          <TabsTrigger value="all">All Alerts ({allAlerts.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unreadAlerts.length})</TabsTrigger>
          <TabsTrigger value="important">Important ({importantAlerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {allAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">No alerts found. Add competitors to start tracking their activities.</p>
              </CardContent>
            </Card>
          ) : (
            allAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isNew={!alert.isRead}
                isImportant={alert.isImportant}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="unread" className="space-y-4">
          {unreadAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">No unread alerts.</p>
              </CardContent>
            </Card>
          ) : (
            unreadAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isNew={true}
                isImportant={alert.isImportant}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="important" className="space-y-4">
          {importantAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">No important alerts.</p>
              </CardContent>
            </Card>
          ) : (
            importantAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isNew={!alert.isRead}
                isImportant={true}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper component for displaying an alert
function AlertCard({ alert, isNew, isImportant }: any) {
  const timeSince = getTimeSince(new Date(alert.createdAt));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className={`h-5 w-5 ${isNew ? 'text-primary' : 'text-muted-foreground'}`} />
            <CardTitle className="text-base">{alert.title}</CardTitle>
          </div>
          {isNew && (
            <div className="px-2 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">New</div>
          )}
          {isImportant && (
            <div className="px-2 py-1 rounded-full bg-yellow-500/10 text-xs font-medium text-yellow-500">
              Important
            </div>
          )}
        </div>
        <CardDescription>{timeSince}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">
          {alert.description || `${alert.competitor?.name || "A competitor"} has ${alert.type?.toLowerCase() || "an update"}.`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/alerts/${alert.id}`}>View Details</a>
          </Button>
          {isNew && (
            <form action={`/api/alerts/${alert.id}/mark-read`} method="POST">
              <Button variant="ghost" size="sm" className="gap-1" type="submit">
                <Check className="h-4 w-4" /> Mark as Read
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to format time since alert
function getTimeSince(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";

  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";

  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";

  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";

  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";

  return Math.floor(seconds) + " seconds ago";
}