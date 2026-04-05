import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, defaultSettings } from '@/lib/prompts'
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ convId: string }> }
) {
  const { convId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // TextStreamChatTransport sends { messages: UIMessage[] }
  const body = await req.json()
  const uiMessages: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }> = body.messages ?? []

  // Extract the last user message text
  const lastUserMsg = [...uiMessages].reverse().find(m => m.role === 'user')
  const message = lastUserMsg?.parts?.find(p => p.type === 'text')?.text?.trim() ?? ''

  if (!message) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, title')
    .eq('id', convId)
    .eq('user_id', user.id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  await supabase.from('messages').insert({
    conversation_id: convId,
    role: 'user',
    content: message,
  })

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', convId)
    .eq('role', 'user')

  let newTitle: string | undefined
  if (count === 1) {
    newTitle = message.slice(0, 50) + (message.length > 50 ? '…' : '')
    await supabase
      .from('conversations')
      .update({ title: newTitle, updated_at: new Date().toISOString() })
      .eq('id', convId)
  } else {
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId)
  }

  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(60)

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()

  const systemPrompt = buildSystemPrompt(
    profile ?? { id: user.id, name: 'friend', created_at: '' },
    { ...defaultSettings, user_id: user.id, updated_at: '', ...settings }
  )

  const messages = (history ?? []).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const result = await streamText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    messages,
    temperature: 0.85,
    maxOutputTokens: 600,
    onFinish: async ({ text }) => {
      await supabase.from('messages').insert({
        conversation_id: convId,
        role: 'assistant',
        content: text,
      })
    },
  })

  return result.toTextStreamResponse()
}
