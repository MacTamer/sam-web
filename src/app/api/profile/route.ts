import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { UpdateSettingsPayload } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
  ])

  return NextResponse.json({ profile, settings })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: UpdateSettingsPayload & { name?: string } = await req.json()
  const { name, ...settingsPayload } = body

  const updates: Promise<unknown>[] = []

  if (name !== undefined) {
    updates.push(
      supabase.from('profiles').upsert({ id: user.id, name }).eq('id', user.id)
    )
  }

  if (Object.keys(settingsPayload).length > 0) {
    updates.push(
      supabase.from('user_settings').upsert({
        user_id: user.id,
        ...settingsPayload,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)
    )
  }

  await Promise.all(updates)
  return NextResponse.json({ status: 'saved' })
}
