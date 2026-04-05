// POST /api/auth/revoke
// Signs out all sessions for the current user globally.
// Use in emergencies — invalidates every session cookie on every device.

import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // scope: 'global' revokes all refresh tokens for this user everywhere
  await supabase.auth.signOut({ scope: 'global' })

  return NextResponse.json({ ok: true })
}
