import { NextResponse } from "next/server"
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Define route patterns
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)"
])

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/competitors(.*)",
  "/ad-analysis(.*)",
  "/alerts(.*)",
  "/assistant(.*)",
  "/settings(.*)",
  "/onboarding(.*)"
])

export default clerkMiddleware(async (auth, req) => {
  // Use destructured auth approach as requested
  const { userId, redirectToSignIn } = await auth()
  
  const url = new URL(req.url);
  const path = url.pathname;
  
  
  // Always allow static files and API routes
  if (path.includes("/_next") || path.includes("/favicon.ico") || path.startsWith("/api/")) {
    return NextResponse.next();
  }
  
  // If user is authenticated
  if (userId) {
    // If authenticated user is trying to access public routes, redirect to dashboard
    if (isPublicRoute(req)) {
      console.log("Redirecting authenticated user from public page to dashboard");
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    
    // Allow authenticated users to access protected routes
    return NextResponse.next();
  }
  
  // If user is not authenticated and trying to access protected routes
  if (!userId && isProtectedRoute(req)) {
    console.log("Redirecting unauthenticated user to sign-in using redirectToSignIn()");
    // Use Clerk's redirectToSignIn function for proper handling
    return redirectToSignIn({ returnBackUrl: req.url });
  }
  
  // Allow access to public routes for unauthenticated users
  if (isPublicRoute(req)) {
    console.log("Allowing access to public route:", path);
    return NextResponse.next();
  }
  
  // For any other routes, allow access
  return NextResponse.next();
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}