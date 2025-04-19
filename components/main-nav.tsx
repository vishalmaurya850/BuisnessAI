"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BarChart3, Bell, Eye, Home, MessageSquare, Settings, Users } from "lucide-react"

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Competitors",
    href: "/competitors",
    icon: Users,
  },
  {
    title: "Ad Analysis",
    href: "/ad-analysis",
    icon: BarChart3,
  },
  {
    title: "Alerts",
    href: "/alerts",
    icon: Bell,
  },
  {
    title: "AI Assistant",
    href: "/assistant",
    icon: MessageSquare,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function MainNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-6 md:gap-10">
      <Link href="/dashboard" className="hidden md:flex items-center space-x-2">
        <Eye className="h-6 w-6 text-primary" />
        <span className="font-bold">CompetitorAI</span>
      </Link>
      <nav className="flex items-center gap-4 md:gap-6">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center text-sm font-medium transition-colors hover:text-primary",
                pathname === item.href ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5 md:mr-2" />
              <span className="hidden md:inline-block">{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
