'use client'

import { useRef, useEffect } from 'react'

interface Props {
  input:     string
  isLoading: boolean
  onChange:  (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit:  (e: React.FormEvent) => void
}

export function Composer({ input, isLoading, onChange, onSubmit }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [input])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && (input ?? '').trim()) {
        onSubmit(e as unknown as React.FormEvent)
      }
    }
  }

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          id="user-input"
          placeholder="Message Sam..."
          rows={1}
          value={input}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          type="submit"
          className={`send-btn${isLoading ? ' loading' : ''}`}
          id="send-btn"
          disabled={isLoading || !(input ?? '').trim()}
        >
          <svg className="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          <span className="btn-spinner" />
        </button>
      </form>
      <p className="composer-hint">Shift+Enter for new line</p>
    </div>
  )
}
