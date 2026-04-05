import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, defaultSettings } from '@/lib/prompts'
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: lastAssistant } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', id)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (lastAssistant) {
    await supabase.from('messages').delete().eq('id', lastAssistant.id)
  }

  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(60)

  if (!history?.length || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Nothing to regenerate' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()

  const systemPrompt = buildSystemPrompt(
    profile ?? { id: user.id, name: 'friend', created_at: '' },
    { ...defaultSettings, user_id: user.id, updated_at: '', ...settings }
  )

  const result = await streamText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    messages: history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    temperature: 0.9,
    maxOutputTokens: 1500,
    onFinish: async ({ text }) => {
      await supabase.from('messages').insert({
        conversation_id: id,
        role: 'assistant',
        content: text,
      })
    },
  })

  return result.toTextStreamResponse()
}
