'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { checkSensitivity } from '@/lib/sensitivity'
import { ActionMenu } from './ActionMenu'

interface AttachedFile {
  name:    string
  content: string
  preview?: string   // base64 data URL for images
  isImage?: boolean
}

interface SamDesktop {
  isDesktop: boolean
  files: {
    open: (options?: object) => Promise<{ filePath: string; content: string } | null>
  }
}

interface Props {
  input:        string
  isLoading:    boolean
  attachedFile: AttachedFile | null
  onChange:     (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit:     (e: React.FormEvent) => void
  onAttach:     (file: AttachedFile) => void
  onRemoveFile: () => void
}

export function Composer({ input, isLoading, attachedFile, onChange, onSubmit, onAttach, onRemoveFile }: Props) {
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const plusBtnRef     = useRef<HTMLButtonElement>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const imageInputRef  = useRef<HTMLInputElement>(null)

  const [isDesktop,     setIsDesktop]     = useState(false)
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [warning,       setWarning]       = useState<string | null>(null)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  useEffect(() => {
    setIsDesktop(!!(window as unknown as { samDesktop?: SamDesktop }).samDesktop?.isDesktop)
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

  // ── File handlers ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async () => {
    if (isDesktop) {
      const sd = (window as unknown as { samDesktop?: SamDesktop }).samDesktop
      if (!sd) return
      const result = await sd.files.open({
        filters: [
          { name: 'Text & code', extensions: ['txt', 'md', 'csv', 'json', 'js', 'ts', 'py', 'html', 'css', 'xml', 'yaml', 'yml'] },
          { name: 'All files',   extensions: ['*'] },
        ],
      })
      if (!result) return
      const name = result.filePath.split(/[\\/]/).pop() ?? 'file'
      onAttach({ name, content: result.content.slice(0, 30000) })
    } else {
      fileInputRef.current?.click()
    }
  }, [isDesktop, onAttach])

  const handleWebFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      onAttach({ name: file.name, content: (reader.result as string).slice(0, 30000) })
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [onAttach])

  const handleImageSelect = useCallback(() => {
    imageInputRef.current?.click()
  }, [])

  const handleWebImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      onAttach({
        name:    file.name,
        content: `[Image: ${file.name} (${Math.round(file.size / 1024)}KB)]`,
        preview: dataUrl,
        isImage: true,
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [onAttach])

  // ── Submit ─────────────────────────────────────────────────────────────────

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

    setWarning(null)
    setPendingSubmit(false)
    onSubmit(e)
  }, [input, attachedFile, pendingSubmit, onSubmit])

  function handleSendAnyway(e: React.FormEvent) {
    e.preventDefault()
    setPendingSubmit(true)
    setWarning(null)
    onSubmit(e)
  }

  // ── Menu items ─────────────────────────────────────────────────────────────

  const menuItems = [
    {
      id:    'file',
      label: 'Upload file',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      ),
      onClick: handleFileSelect,
    },
    {
      id:    'image',
      label: 'Upload image',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
      onClick: handleImageSelect,
    },
    {
      id:     'voice',
      label:  'Voice input (coming soon)',
      dimmed: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      ),
      onClick: () => {},
    },
  ]

  const canSend = !isLoading && ((input ?? '').trim().length > 0 || attachedFile !== null)

  return (
    <div className="composer-wrap">
      {/* Hidden web file inputs */}
      <input ref={fileInputRef}  type="file" style={{ display: 'none' }} onChange={handleWebFileChange}
        accept=".txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml,.yaml,.yml" />
      <input ref={imageInputRef} type="file" style={{ display: 'none' }} onChange={handleWebImageChange}
        accept="image/*" capture="environment" />

      {/* Sensitivity warning */}
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
            <button className="sensitivity-btn-send" onClick={handleSendAnyway}>Send anyway</button>
            <button className="sensitivity-btn-cancel" onClick={() => setWarning(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Attachment preview */}
      {attachedFile && (
        <div className="attachment-chip">
          {attachedFile.isImage && attachedFile.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachedFile.preview} alt="preview" className="attachment-img-preview" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}
          <span className="attachment-name">{attachedFile.name}</span>
          <button className="attachment-remove" onClick={onRemoveFile} aria-label="Remove">×</button>
        </div>
      )}

      {/* Action menu popup */}
      <ActionMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
        anchorRef={plusBtnRef}
      />

      <form className="composer" onSubmit={handleSubmitWithCheck}>
        {/* + button */}
        <button
          ref={plusBtnRef}
          type="button"
          className={`plus-btn${menuOpen ? ' active' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          disabled={isLoading}
          aria-label="Add attachment"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="18" height="18">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

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
      <p className="composer-hint">Shift+Enter for new line</p>
    </div>
  )
}
