import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

interface RawMessage {
  role: string
  content: string
}

/**
 * Generates a compact context summary of a conversation.
 * Called after every 15 user messages — cheap (gpt-4o-mini, ~200 tokens out).
 *
 * Returns a 150-word max summary covering:
 * - what project/phase is active
 * - key decisions made
 * - what's been completed
 * - what's currently in progress
 */
export async function summarizeConversation(
  messages: RawMessage[],
  existingSummary: string | null
): Promise<string> {
  const historyText = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Sam'}: ${m.content}`)
    .join('\n')

  const context = existingSummary
    ? `Previous summary:\n${existingSummary}\n\nNew messages since then:\n${historyText}`
    : `Full conversation:\n${historyText}`

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    temperature: 0.3,
    maxOutputTokens: 200,
    prompt: `You are summarizing a conversation between a user and their AI assistant Sam.

${context}

Write a concise context summary (max 150 words) covering:
- What the user is currently working on (project name, phase, feature)
- Key decisions or choices already made
- What has been completed
- What is currently in progress or pending
- Any important constraints or preferences mentioned

Be specific and factual. No filler. Write in present tense as if briefing someone who is about to continue this conversation.`,
  })

  return text.trim()
}

/**
 * Decide whether to build context from summary+recent or full history.
 *
 * If a summary exists and there are enough messages, use:
 *   summary (compressed older context) + last 12 messages (recent context)
 *
 * Otherwise use up to 60 raw messages.
 */
export function buildMessageContext(
  messages: RawMessage[],
  summary: string | null
): { messages: RawMessage[]; sessionSummary: string | null } {
  if (summary && messages.length > 18) {
    return {
      messages:       messages.slice(-12),
      sessionSummary: summary,
    }
  }
  return {
    messages:       messages.slice(-60),
    sessionSummary: null,
  }
}
