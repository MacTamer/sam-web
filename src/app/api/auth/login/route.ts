// POST /api/auth/login
// Accepts { username, password } — never exposes email to the client.
// Validates username against SAM_USERNAME env var, then authenticates
// with Supabase using the internal SAM_USER_EMAIL.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { username, password } = await req.json()

  // Both fields required
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
  }

  // Validate username — must match the single configured user
  const allowedUsername = process.env.SAM_USERNAME
  const internalEmail   = process.env.SAM_USER_EMAIL

  if (!allowedUsername || !internalEmail) {
    console.error('SAM_USERNAME or SAM_USER_EMAIL not set in .env.local')
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
  }

  // Case-insensitive username check
  if (username.trim().toLowerCase() !== allowedUsername.toLowerCase()) {
    // Deliberate vague error — don't reveal which field is wrong
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
  }

  // Authenticate with Supabase using the internal email
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password,
  })

  if (error) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
