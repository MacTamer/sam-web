'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'
import { Composer } from './Composer'

interface Props {
  convId:          string
  onTitleUpdate:   (id: string, title: string) => void
  onToggleSidebar: () => void
}

export function ChatArea({ convId, onTitleUpdate, onToggleSidebar }: Props) {
  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const messagesRef     = useRef<HTMLDivElement>(null)
  const userScrolledUp  = useRef(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [input, setInput] = useState('')

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new TextStreamChatTransport({ api: `/api/chat/${convId}` }),
    id: convId,
    onFinish: async () => {
      const conv = await fetch(`/api/conversations/${convId}`).then(r => r.json())
      if (conv.title && conv.title !== 'New chat') onTitleUpdate(convId, conv.title)
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Load existing messages when conversation changes
  useEffect(() => {
    setInitialLoaded(false)
    setMessages([])
    fetch(`/api/conversations/${convId}`)
      .then(r => r.json())
      .then(conv => {
        if (conv.messages) {
          setMessages(conv.messages.map((m: { id: string; role: string; content: string }) => ({
            id:    m.id,
            role:  m.role as 'user' | 'assistant',
            parts: [{ type: 'text' as const, text: m.content }],
          })))
        }
        setInitialLoaded(true)
      })
  }, [convId, setMessages])

  // Auto-scroll tracking
  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    function onScroll() {
      if (!el) return
      const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      userScrolledUp.current = fromBottom > 80
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!userScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const copyMessage = useCallback(async (content: string, btn: HTMLButtonElement) => {
    await navigator.clipboard.writeText(content).catch(() => {})
    const prev = btn.innerHTML
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>Copied`
    btn.classList.add('copied')
    setTimeout(() => { btn.innerHTML = prev; btn.classList.remove('copied') }, 2000)
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ parts: [{ type: 'text', text: input.trim() }] })
    setInput('')
  }, [input, isLoading, sendMessage])

  const isEmpty = initialLoaded && messages.length === 0

  function getMessageText(msg: (typeof messages)[0]): string {
    return msg.parts
      .filter(p => p.type === 'text')
      .map(p => (p as { type: 'text'; text: string }).text)
      .join('')
  }

  return (
    <div className={`main${!isEmpty ? ' chatting' : ''}`} id="main">
      <button className="mobile-menu-btn" onClick={onToggleSidebar}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {isEmpty && <h1 className="empty-heading">What&apos;s on your mind?</h1>}

      <div className="messages" ref={messagesRef}>
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1
          const text = getMessageText(m)
          return (
            <div key={m.id} className={`message ${m.role === 'user' ? 'user' : 'sam'}${m.role === 'assistant' && isLoading && isLast ? ' streaming' : ''}`}>
              {m.role === 'assistant' && (
                <div className="msg-label">Sam</div>
              )}
              <div className="msg-content">{text}</div>
              {m.role === 'assistant' && !isLoading && (
                <div className="msg-actions">
                  <button
                    className="msg-action-btn"
                    onClick={e => copyMessage(text, e.currentTarget)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="message sam" id="typing-indicator">
            <div className="msg-label">Sam</div>
            <div className="msg-content">
              <div className="typing-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <Composer
        input={input}
        isLoading={isLoading}
        onChange={e => setInput(e.target.value)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
