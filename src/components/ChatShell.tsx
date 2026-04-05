'use client'

import { useState, useCallback } from 'react'
import { Sidebar } from './sidebar/Sidebar'
import { ChatArea } from './chat/ChatArea'
import { SettingsModal } from './settings/SettingsModal'
import type { ConversationSummary, Profile, UserSettings } from '@/types'

interface Props {
  initialConversations: ConversationSummary[]
  initialProfile:  Profile | null
  initialSettings: UserSettings | null
}

export function ChatShell({ initialConversations, initialProfile, initialSettings }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations)
  const [activeConvId,  setActiveConvId]  = useState<string | null>(
    initialConversations[0]?.id ?? null
  )
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [modalSection,  setModalSection]  = useState<string | null>(null)
  const [profile,       setProfile]       = useState(initialProfile)
  const [settings,      setSettings]      = useState(initialSettings)

  const openModal  = useCallback((section: string) => setModalSection(section), [])
  const closeModal = useCallback(() => setModalSection(null), [])

  const createConversation = useCallback(async () => {
    const res  = await fetch('/api/conversations', { method: 'POST' })
    const conv = await res.json()
    setConversations(prev => [conv, ...prev])
    setActiveConvId(conv.id)
    setSidebarOpen(false)
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConvId === id) {
      const remaining = conversations.filter(c => c.id !== id)
      if (remaining.length > 0) {
        setActiveConvId(remaining[0].id)
      } else {
        // Auto-create a new conversation
        const res  = await fetch('/api/conversations', { method: 'POST' })
        const conv = await res.json()
        setConversations([conv])
        setActiveConvId(conv.id)
      }
    }
  }, [activeConvId, conversations])

  const updateConvTitle = useCallback((id: string, title: string) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, title } : c)
    )
  }, [])

  // If no conversations, create one
  if (conversations.length === 0 && activeConvId === null) {
    createConversation()
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        isOpen={sidebarOpen}
        profile={profile}
        onNewChat={createConversation}
        onSelectConv={setActiveConvId}
        onDeleteConv={deleteConversation}
        onOpenSettings={openModal}
        onToggle={() => setSidebarOpen(o => !o)}
        onClose={() => setSidebarOpen(false)}
      />

      {activeConvId && (
        <ChatArea
          convId={activeConvId}
          onTitleUpdate={updateConvTitle}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
        />
      )}

      {modalSection && (
        <SettingsModal
          section={modalSection}
          profile={profile}
          settings={settings}
          onClose={closeModal}
          onSaved={(p, s) => { setProfile(p); setSettings(s) }}
        />
      )}

      {sidebarOpen && (
        <div className="overlay active" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
