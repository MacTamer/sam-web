import { createClient } from '@/lib/supabase/server'
import { saveMemory, deleteMemory, deleteAllMemories, type MemoryType } from '@/lib/memory'
import { NextResponse } from 'next/server'

// GET /api/memory — list all memories
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('memories')
    .select('id, type, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/memory — manually save a memory
// body: { type: MemoryType, content: string }
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, content } = await req.json() as { type: MemoryType; content: string }

  if (!type || !content?.trim()) {
    return NextResponse.json({ error: 'type and content are required' }, { status: 400 })
  }

  const validTypes: MemoryType[] = ['general', 'project', 'preference', 'task']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid memory type' }, { status: 400 })
  }

  await saveMemory(user.id, type, content)
  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE /api/memory — delete one or all memories
// body: { id: string } to delete one, or { all: true } to wipe
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { id?: string; all?: boolean }

  if (body.all) {
    await deleteAllMemories(user.id)
    return NextResponse.json({ ok: true })
  }

  if (body.id) {
    await deleteMemory(user.id, body.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Provide id or all:true' }, { status: 400 })
}
