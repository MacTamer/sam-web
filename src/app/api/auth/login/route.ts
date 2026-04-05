// POST /api/auth/login
// Accepts { username, password } — never exposes email to the client.
// Validates username against SAM_USERNAME env var, then authenticates
// with Supabase using the internal SAM_USER_EMAIL.

import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // ── Rate limiting — 5 attempts per IP per 15 minutes ─────────────────────
  const ip  = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl  = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000)

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      {
        status:  429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    )
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
  }

  const allowedUsername = process.env.SAM_USERNAME
  const internalEmail   = process.env.SAM_USER_EMAIL

  if (!allowedUsername || !internalEmail) {
    console.error('SAM_USERNAME or SAM_USER_EMAIL not set')
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
  }

  if (username.trim().toLowerCase() !== allowedUsername.toLowerCase()) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password,
  })

  if (error) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
  }

  const isMobile = req.headers.get('x-sam-platform') === 'mobile'
  return NextResponse.json({ ok: true, ...(isMobile ? { email: internalEmail } : {}) })
}
