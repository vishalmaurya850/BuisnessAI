// This file is no longer needed since we're removing the webhook
// We'll keep an empty implementation for backward compatibility
import { NextResponse } from "next/server"

export async function POST() {
  // Return a simple success response
  return NextResponse.json({ success: true })
}
