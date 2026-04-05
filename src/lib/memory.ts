import { createClient } from '@/lib/supabase/server'

export type MemoryType = 'general' | 'project' | 'preference' | 'task'

export interface Memory {
  id:         string
  type:       MemoryType
  content:    string
  created_at: string
}

// ── Fetch ──────────────────────────────────────────────────────────────────

/** Pull all memories for a user (used to inject into system prompt). */
export async function getMemories(userId: string): Promise<Memory[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('memories')
    .select('id, type, content, created_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(60)
  return (data ?? []) as Memory[]
}

// ── Save ───────────────────────────────────────────────────────────────────

export async function saveMemory(
  userId: string,
  type: MemoryType,
  content: string,
  sourceConvId?: string
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('memories').insert({
    user_id:        userId,
    type,
    content:        content.trim(),
    source_conv_id: sourceConvId ?? null,
    updated_at:     new Date().toISOString(),
  })
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteMemory(userId: string, memoryId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('memories').delete().eq('id', memoryId).eq('user_id', userId)
}

export async function deleteAllMemories(userId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('memories').delete().eq('user_id', userId)
}

// ── Parse memory tags from Sam's response ─────────────────────────────────

const MEMORY_TAG = /\[MEMORY:(general|project|preference|task)\|([^\]]{1,300})\]/gi

/**
 * Scans assistant response text for [MEMORY:type|content] tags.
 * Returns the text with tags stripped + an array of extracted memories.
 */
export function parseMemoryTags(text: string): {
  cleanText: string
  extracted: Array<{ type: MemoryType; content: string }>
} {
  const extracted: Array<{ type: MemoryType; content: string }> = []

  const cleanText = text
    .replace(MEMORY_TAG, (_, type, content) => {
      extracted.push({ type: type.toLowerCase() as MemoryType, content: content.trim() })
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')  // collapse extra blank lines left by removed tags
    .trim()

  return { cleanText, extracted }
}

// ── Build memory block for system prompt ──────────────────────────────────

export function buildMemoryBlock(memories: Memory[], name: string): string {
  if (!memories.length) return ''

  const groups: Record<MemoryType, Memory[]> = {
    general:    [],
    project:    [],
    preference: [],
    task:       [],
  }
  for (const m of memories) groups[m.type].push(m)

  const lines: string[] = [`\n## What you remember about ${name}`]

  const add = (label: string, items: Memory[], max: number) => {
    if (!items.length) return
    lines.push(`**${label}:**`)
    items.slice(0, max).forEach(m => lines.push(`- ${m.content}`))
  }

  add('Personal',            groups.general,    8)
  add('Projects & decisions', groups.project,   8)
  add('Preferences',          groups.preference, 6)
  add('Current tasks',        groups.task,       6)

  lines.push('\n(Use this context naturally — never recite it verbatim.)\n')
  return lines.join('\n')
}
