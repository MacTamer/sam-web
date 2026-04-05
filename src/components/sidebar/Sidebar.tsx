'use client'

import { useState, useRef, useEffect } from 'react'
import type { ConversationSummary, Profile } from '@/types'

interface Props {
  conversations: ConversationSummary[]
  activeConvId:  string | null
  isOpen:        boolean
  profile:       Profile | null
  onNewChat:     () => void
  onSelectConv:  (id: string) => void
  onDeleteConv:  (id: string) => void
  onOpenSettings:(section: string) => void
  onToggle:      () => void
  onClose:       () => void
}

export function Sidebar({
  conversations, activeConvId, isOpen, profile,
  onNewChat, onSelectConv, onDeleteConv, onOpenSettings, onClose,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const profileBtnRef = useRef<HTMLButtonElement>(null)
  const popoverRef    = useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

  const displayName = profile?.name || 'Me'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  function openPopover() {
    if (profileBtnRef.current) {
      const rect = profileBtnRef.current.getBoundingClientRect()
      setPopoverStyle({
        position: 'fixed',
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
        width: rect.width,
      })
    }
    setPopoverOpen(true)
  }

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    function handler(e: MouseEvent) {
      if (
        !popoverRef.current?.contains(e.target as Node) &&
        !profileBtnRef.current?.contains(e.target as Node)
      ) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [popoverOpen])

  function handleMenuClick(section: string) {
    setPopoverOpen(false)
    onOpenSettings(section)
  }

  return (
    <>
      <div className={`sidebar${isOpen ? ' open' : ''}`} id="sidebar">
        <div className="sidebar-top">
          <span className="brand">Sam</span>
          <button className="new-chat-btn" onClick={onNewChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New chat
          </button>
        </div>

        <div className="history-section">
          <span className="history-label">Conversations</span>
          <div className="history-list">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`history-item${conv.id === activeConvId ? ' active' : ''}`}
                data-conv-id={conv.id}
                onClick={() => { onSelectConv(conv.id); onClose() }}
              >
                <span className="history-item-title">{conv.title}</span>
                <button
                  className="history-item-del"
                  title="Delete"
                  onClick={e => { e.stopPropagation(); onDeleteConv(conv.id) }}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Account popover (rendered here, positioned fixed via JS) */}
        {popoverOpen && (
          <div className="account-popover open" style={popoverStyle} ref={popoverRef}>
            <button className="popover-item" onClick={() => handleMenuClick('personalization')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              Personalization
            </button>
            <button className="popover-item" onClick={() => handleMenuClick('general')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
            <div className="popover-divider" />
            <button className="popover-item" onClick={() => handleMenuClick('memory')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              Memory
            </button>
          </div>
        )}

        {/* Pinned profile button */}
        <div className="sidebar-profile">
          <button
            className="profile-btn"
            ref={profileBtnRef}
            onClick={openPopover}
            aria-expanded={popoverOpen}
          >
            <div className="profile-avatar">{avatarLetter}</div>
            <span className="profile-name">{displayName}</span>
            <svg className="profile-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
