'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { checkSensitivity } from '@/lib/sensitivity'

interface AttachedFile {
  name:    string
  content: string
}

interface Props {
  input:          string
  isLoading:      boolean
  attachedFile:   AttachedFile | null
  onChange:       (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit:       (e: React.FormEvent) => void
  onAttachFile:   () => void
  onRemoveFile:   () => void
}

export function Composer({ input, isLoading, attachedFile, onChange, onSubmit, onAttachFile, onRemoveFile }: Props) {
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const [isDesktop,  setIsDesktop]  = useState(false)
  const [warning,    setWarning]    = useState<string | null>(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  useEffect(() => {
    setIsDesktop(!!(window as unknown as { samDesktop?: { isDesktop?: boolean } }).samDesktop?.isDesktop)
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [input])

  // Clear warning when input changes
  useEffect(() => {
    if (warning) setWarning(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && ((input ?? '').trim() || attachedFile)) {
        handleSubmitWithCheck(e as unknown as React.FormEvent)
      }
    }
  }

  const handleSubmitWithCheck = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const text = (input ?? '').trim()
    if (!text && !attachedFile) return

    const { isSensitive, reason } = checkSensitivity(text)

    if (isSensitive && !pendingSubmit) {
      setWarning(reason)
      return
    }

    // Reset and send
    setWarning(null)
    setPendingSubmit(false)
    onSubmit(e)
  }, [input, attachedFile, pendingSubmit, onSubmit])

  function handleSendAnyway(e: React.FormEvent) {
    e.preventDefault()
    setPendingSubmit(true)
    setWarning(null)
    // Submit directly — bypass check since user explicitly chose to send
    onSubmit(e)
  }

  const canSend = !isLoading && ((input ?? '').trim().length > 0 || attachedFile !== null)

  return (
    <div className="composer-wrap">
      {/* Sensitivity warning banner */}
      {warning && (
        <div className="sensitivity-warning">
          <span className="sensitivity-icon">⚠</span>
          <span className="sensitivity-text">
            This message may contain a <strong>{warning}</strong>. Sending this will transmit it to OpenAI.
          </span>
          <div className="sensitivity-actions">
            {isDesktop && (
              <button className="sensitivity-btn-vault" onClick={() => setWarning(null)}>
                Save to Vault instead
              </button>
            )}
            <button className="sensitivity-btn-send" onClick={handleSendAnyway}>
              Send anyway
            </button>
            <button className="sensitivity-btn-cancel" onClick={() => setWarning(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {attachedFile && (
        <div className="attachment-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="attachment-name">{attachedFile.name}</span>
          <button className="attachment-remove" onClick={onRemoveFile} aria-label="Remove file">×</button>
        </div>
      )}

      <form className="composer" onSubmit={handleSubmitWithCheck}>
        {isDesktop && (
          <button
            type="button"
            className="attach-btn"
            onClick={onAttachFile}
            disabled={isLoading}
            aria-label="Attach file"
            title="Attach a local file"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
        )}
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
          disabled={!canSend}
        >
          <svg className="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          <span className="btn-spinner" />
        </button>
      </form>
      <p className="composer-hint">Shift+Enter for new line{isDesktop ? ' · Paperclip to attach a file' : ''}</p>
    </div>
  )
}
