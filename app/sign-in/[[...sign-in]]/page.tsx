import { SignIn } from "@clerk/nextjs"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

export default async function SignInPage() {
  // If user is already signed in, redirect to dashboard
  const { userId } = await auth()
  if (userId) {
    redirect("/dashboard")
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary: "bg-primary hover:bg-primary/90",
            footerActionLink: "text-primary hover:text-primary/90",
          },
        }}
        redirectUrl="/dashboard"
        afterSignInUrl="/dashboard"
      />
    </div>
  )
}
