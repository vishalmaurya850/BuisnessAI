import { NextResponse } from "next/server"
import { clerkMiddleware } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// Custom middleware to check if user has completed onboarding
async function checkOnboarding(userId: string | null): Promise<boolean> {
  if (!userId) return false

  try {
    // Check if user has a business profile
    const business = await db.query.businesses.findFirst({
      where: eq(businesses.userId, userId),
    })

    return !!business
  } catch (error) {
    console.error("Error checking onboarding status:", error)
    return false
  }
}

// Create our custom middleware that wraps Clerk's
export default clerkMiddleware(async (auth: any, request: Request) => {
  const url = new URL(request.url)
  const isPublicPath =
    url.pathname === "/" ||
    url.pathname.startsWith("/sign-in") ||
    url.pathname.startsWith("/sign-up") ||
    url.pathname.includes("_next") ||
    url.pathname.includes("favicon.ico")

  // If the user is signed in and trying to access a protected route
  if (auth.userId && !isPublicPath) {
    // Check if the user is trying to access the onboarding page
    if (url.pathname === "/onboarding") {
      // Allow access to onboarding
      return NextResponse.next()
    }

    // For all other protected routes, check if the user has completed onboarding
    if (
      url.pathname === "/dashboard" ||
      url.pathname.startsWith("/competitors") ||
      url.pathname.startsWith("/ad-analysis") ||
      url.pathname.startsWith("/alerts") ||
      url.pathname.startsWith("/assistant") ||
      url.pathname.startsWith("/settings")
    ) {
      const hasCompletedOnboarding = await checkOnboarding(auth.userId)

      if (!hasCompletedOnboarding) {
        // Redirect to onboarding if not completed
        return NextResponse.redirect(new URL("/onboarding", request.url))
      }
    }

    // Allow access to all other protected routes
    return NextResponse.next()
  }

  // If the user is not signed in and trying to access a protected route
  if (!auth.userId && !isPublicPath) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  // Allow access to public routes
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}
