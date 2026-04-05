import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, defaultSettings } from '@/lib/prompts'
import { getMemories, saveMemory, parseMemoryTags } from '@/lib/memory'
import { summarizeConversation, buildMessageContext } from '@/lib/summarize'
import { rateLimit } from '@/lib/ratelimit'
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

  // Rate limit: 60 messages per user per hour
  const rl = rateLimit(`chat:${user.id}`, 60, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
  }

  const isDesktop = req.headers.get('x-sam-desktop') === '1'
  const body = await req.json()
  const uiMessages: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }> = body.messages ?? []

  const lastUserMsg = [...uiMessages].reverse().find(m => m.role === 'user')
  const message = lastUserMsg?.parts?.find(p => p.type === 'text')?.text?.trim() ?? ''

  if (!message) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, title, summary')
    .eq('id', convId)
    .eq('user_id', user.id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  await supabase.from('messages').insert({
    conversation_id: convId,
    role: 'user',
    content: message,
  })

  // Count user messages (for title + summarization trigger)
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', convId)
    .eq('role', 'user')

  const userCount = count ?? 0

  if (userCount === 1) {
    const newTitle = message.slice(0, 50) + (message.length > 50 ? '…' : '')
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

  // Fetch everything needed in parallel
  const [historyResult, profileResult, settingsResult, memories] = await Promise.all([
    supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(80),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
    getMemories(user.id),
  ])

  const rawHistory = (historyResult.data ?? []).map(m => ({
    role:    m.role,
    content: m.content,
  }))

  // Use summary+recent when available, otherwise full history
  const { messages: contextMessages, sessionSummary } = buildMessageContext(
    rawHistory,
    conv.summary ?? null
  )

  const profile  = profileResult.data
  const settings = settingsResult.data

  const systemPrompt = buildSystemPrompt(
    profile  ?? { id: user.id, name: 'friend', created_at: '' },
    { ...defaultSettings, user_id: user.id, updated_at: '', ...settings },
    isDesktop,
    memories,
    sessionSummary,
  )

  const chatMessages = contextMessages.map(m => ({
    role:    m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const result = await streamText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    messages: chatMessages,
    temperature: 0.85,
    maxOutputTokens: 1500,
    onFinish: async ({ text }) => {
      const { cleanText, extracted } = parseMemoryTags(text)

      await supabase.from('messages').insert({
        conversation_id: convId,
        role:    'assistant',
        content: cleanText,
      })

      for (const m of extracted) {
        await saveMemory(user.id, m.type, m.content, convId)
      }

      // Re-summarize every 15 user messages (async — doesn't block the response)
      if (userCount > 0 && userCount % 15 === 0) {
        const { data: fullHistory } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(80)

        if (fullHistory && fullHistory.length > 0) {
          try {
            const newSummary = await summarizeConversation(
              fullHistory.map(m => ({ role: m.role, content: m.content })),
              conv.summary ?? null
            )
            await supabase
              .from('conversations')
              .update({ summary: newSummary })
              .eq('id', convId)
          } catch {
            // summarization failure is non-fatal
          }
        }
      }
    },
  })

  return result.toTextStreamResponse()
}
