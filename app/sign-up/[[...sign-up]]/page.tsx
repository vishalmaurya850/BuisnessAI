import { SignUp } from "@clerk/nextjs"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

export default async function SignUpPage() {
  // If user is already signed in, redirect to dashboard
  const { userId } = await auth()
  if (userId) {
    redirect("/dashboard")
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <SignUp
        appearance={{
          elements: {
            formButtonPrimary: "bg-primary hover:bg-primary/90",
            footerActionLink: "text-primary hover:text-primary/90",
          },
        }}
        redirectUrl="/onboarding"
        afterSignUpUrl="/onboarding"
      />
    </div>
  )
}