// ── Database row types ─────────────────────────────────

export interface Profile {
  id: string
  name: string
  created_at: string
}

export interface UserSettings {
  user_id: string
  tone: string
  directness: string
  warmth: string
  response_length: string
  emoji_usage: boolean
  use_headers: boolean
  topics_of_interest: string[]
  about_me_facts: string[]
  custom_instructions: string
  technical_level: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// ── API request/response shapes ────────────────────────

export interface ConversationSummary {
  id: string
  title: string
  updated_at: string
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[]
}

export interface UpdateSettingsPayload {
  name?: string
  tone?: string
  directness?: string
  warmth?: string
  response_length?: string
  emoji_usage?: boolean
  use_headers?: boolean
  topics_of_interest?: string[]
  about_me_facts?: string[]
  custom_instructions?: string
  technical_level?: string
}

export interface Memory {
  id:         string
  user_id?:   string
  type:       'general' | 'project' | 'preference' | 'task'
  content:    string
  created_at: string
}

// ── Client-side UI state ───────────────────────────────

export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}
