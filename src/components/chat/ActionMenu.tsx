'use client'

import { useRef, useEffect } from 'react'

interface MenuItem {
  id:       string
  label:    string
  icon:     React.ReactNode
  disabled?: boolean
  dimmed?:  boolean
  onClick:  () => void
}

interface Props {
  open:    boolean
  onClose: () => void
  items:   MenuItem[]
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

export function ActionMenu({ open, onClose, items, anchorRef }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        menuRef.current   && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, anchorRef])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="action-menu" ref={menuRef} role="menu">
      {items.map(item => (
        <button
          key={item.id}
          className={`action-menu-item${item.dimmed ? ' dimmed' : ''}`}
          disabled={item.disabled}
          onClick={() => { item.onClick(); onClose() }}
          role="menuitem"
        >
          <span className="action-menu-icon">{item.icon}</span>
          <span className="action-menu-label">{item.label}</span>
        </button>
      ))}
    </div>
  )
}
