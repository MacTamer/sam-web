'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import { Composer } from './Composer'

interface AttachedFile {
  name:     string
  content:  string
  preview?: string
  isImage?: boolean
}

interface Props {
  convId:          string
  onTitleUpdate:   (id: string, title: string) => void
  onToggleSidebar: () => void
}

export function ChatArea({ convId, onTitleUpdate, onToggleSidebar }: Props) {
  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const messagesRef     = useRef<HTMLDivElement>(null)
  const userScrolledUp  = useRef(false)
  const isDesktopRef    = useRef(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [input,         setInput]         = useState('')
  const [regenerating,  setRegenerating]  = useState(false)
  const [attachedFile,  setAttachedFile]  = useState<AttachedFile | null>(null)

  // Detect desktop after mount
  useEffect(() => {
    isDesktopRef.current = !!(window as unknown as { samDesktop?: { isDesktop?: boolean } }).samDesktop?.isDesktop
  }, [])

  // Transport — sends x-sam-desktop header when running in Electron
  const transport = useMemo(() => new TextStreamChatTransport({
    api:     `/api/chat/${convId}`,
    headers: () => (isDesktopRef.current ? { 'x-sam-desktop': '1' } : {}) as Record<string, string>,
  }), [convId])

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
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

  const handleRegenerate = useCallback(async () => {
    if (isLoading || regenerating) return
    setRegenerating(true)
    try {
      const res = await fetch(`/api/conversations/${convId}/regenerate`, { method: 'POST' })
      if (!res.ok) return
      setMessages(prev => {
        const idx = [...prev].reverse().findIndex(m => m.role === 'assistant')
        if (idx === -1) return prev
        const removeAt = prev.length - 1 - idx
        return prev.filter((_, i) => i !== removeAt)
      })
      const conv = await fetch(`/api/conversations/${convId}`).then(r => r.json())
      if (conv.messages) {
        setMessages(conv.messages.map((m: { id: string; role: string; content: string }) => ({
          id:    m.id,
          role:  m.role as 'user' | 'assistant',
          parts: [{ type: 'text' as const, text: m.content }],
        })))
      }
    } finally {
      setRegenerating(false)
    }
  }, [convId, isLoading, regenerating, setMessages])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const text = (input ?? '').trim()
    if ((!text && !attachedFile) || isLoading) return

    // Build the message — append file content inline if attached
    let messageText = text
    if (attachedFile) {
      const tag       = attachedFile.isImage ? 'image' : 'file'
      const fileBlock = `\n\n[Attached ${tag}: ${attachedFile.name}]\n${attachedFile.content}\n[End of ${tag}]`
      messageText     = text ? text + fileBlock : `Please look at this ${tag}:\n${fileBlock}`
    }

    sendMessage({ parts: [{ type: 'text', text: messageText }] })
    setInput('')
    setAttachedFile(null)
  }, [input, attachedFile, isLoading, sendMessage])

  const isEmpty = initialLoaded && messages.length === 0

  function getMessageText(msg: (typeof messages)[0]): string {
    return msg.parts
      .filter(p => p.type === 'text')
      .map(p => (p as { type: 'text'; text: string }).text)
      .join('')
  }

  // Strip the raw file/image block from display — show a clean chip instead
  function splitMessageAndFile(text: string): { message: string; fileName: string | null; isImage: boolean } {
    const match = text.match(/^([\s\S]*?)\n?\n?\[Attached (file|image): (.+?)\][\s\S]*?\[End of (file|image)\][\s\S]*$/)
    if (!match) return { message: text, fileName: null, isImage: false }
    return { message: match[1].trim(), fileName: match[3], isImage: match[2] === 'image' }
  }

  const lastAssistantIdx = messages.map(m => m.role).lastIndexOf('assistant')

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
          const isLast         = i === messages.length - 1
          const isLastAssistant = i === lastAssistantIdx
          const rawText        = getMessageText(m)
          const { message: displayText, fileName, isImage: fileIsImage } = m.role === 'user'
            ? splitMessageAndFile(rawText)
            : { message: rawText, fileName: null, isImage: false }

          return (
            <div key={m.id} className={`message ${m.role === 'user' ? 'user' : 'sam'}${m.role === 'assistant' && isLoading && isLast ? ' streaming' : ''}`}>
              {m.role === 'assistant' && (
                <div className="msg-label">Sam</div>
              )}
              {fileName && (
                <div className="msg-file-chip">
                  {fileIsImage ? '🖼' : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  {fileName}
                </div>
              )}
              <div className="msg-content">
                {m.role === 'assistant' ? (
                  <ReactMarkdown>{displayText}</ReactMarkdown>
                ) : (
                  displayText
                )}
              </div>
              {m.role === 'assistant' && !isLoading && (
                <div className="msg-actions">
                  <button
                    className="msg-action-btn"
                    onClick={e => copyMessage(rawText, e.currentTarget)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </button>
                  {isLastAssistant && (
                    <button
                      className="msg-action-btn"
                      onClick={handleRegenerate}
                      disabled={regenerating}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
                      </svg>
                      {regenerating ? 'Regenerating…' : 'Regenerate'}
                    </button>
                  )}
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
        attachedFile={attachedFile}
        onChange={e => setInput(e.target.value)}
        onSubmit={handleSubmit}
        onAttach={setAttachedFile}
        onRemoveFile={() => setAttachedFile(null)}
      />
    </div>
  )
}
