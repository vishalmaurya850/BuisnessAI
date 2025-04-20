import type React from "react"
import { MainNav } from "@/components/main-nav"
import { UserNav } from "@/components/user-nav"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AIAssistantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <MainNav />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <UserNav />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
