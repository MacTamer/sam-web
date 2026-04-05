'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Profile, UserSettings, Memory } from '@/types'

interface SamDesktop {
  isDesktop: boolean
  vault: {
    set:    (key: string, value: string) => Promise<void>
    get:    (key: string)               => Promise<string | null>
    delete: (key: string)               => Promise<void>
    keys:   ()                          => Promise<string[]>
  }
}

interface Props {
  section:  string
  profile:  Profile | null
  settings: UserSettings | null
  onClose:  () => void
  onSaved:  (profile: Profile, settings: UserSettings) => void
}

const SECTIONS = ['general', 'personalization', 'memory', 'security', 'account'] as const

export function SettingsModal({ section: initialSection, profile, settings, onClose, onSaved }: Props) {
  const [activeSection, setActiveSection] = useState(initialSection)
  const [saving,        setSaving]        = useState(false)
  const [saveMsg,       setSaveMsg]       = useState('')
  const [isDesktop,     setIsDesktop]     = useState(false)

  // Vault state
  const [vaultKeys,     setVaultKeys]     = useState<string[]>([])
  const [vaultKey,      setVaultKey]      = useState('')
  const [vaultValue,    setVaultValue]    = useState('')
  const [vaultSaving,   setVaultSaving]   = useState(false)
  const [vaultMsg,      setVaultMsg]      = useState('')
  const [revealedKey,   setRevealedKey]   = useState<string | null>(null)
  const [revealedValue, setRevealedValue] = useState<string>('')

  // Memory state
  const [memories,      setMemories]      = useState<Memory[]>([])
  const [memLoading,    setMemLoading]    = useState(false)
  const [newMemType,    setNewMemType]    = useState<Memory['type']>('general')
  const [newMemContent, setNewMemContent] = useState('')
  const [memSaving,     setMemSaving]     = useState(false)

  // Security state
  const [wiping,        setWiping]        = useState(false)
  const [revoking,      setRevoking]      = useState(false)

  // Form state
  const [name,         setName]         = useState(profile?.name || '')
  const [interests,    setInterests]    = useState((settings?.topics_of_interest || []).join(', '))
  const [tone,         setTone]         = useState(settings?.tone || 'casual and warm')
  const [directness,   setDirectness]   = useState(settings?.directness || 'balanced')
  const [warmth,       setWarmth]       = useState(settings?.warmth || 'warm')
  const [respLength,   setRespLength]   = useState(settings?.response_length || 'concise')
  const [emoji,        setEmoji]        = useState(settings?.emoji_usage || false)
  const [headers,      setHeaders]      = useState(settings?.use_headers || false)
  const [facts,        setFacts]        = useState((settings?.about_me_facts || []).join('\n'))
  const [instructions, setInstructions] = useState(settings?.custom_instructions || '')

  useEffect(() => {
    const sd = (window as unknown as { samDesktop?: SamDesktop }).samDesktop
    if (sd?.isDesktop) {
      setIsDesktop(true)
      sd.vault.keys().then(setVaultKeys)
    }
  }, [])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const payload = {
      name,
      tone, directness, warmth,
      response_length: respLength,
      emoji_usage: emoji,
      use_headers: headers,
      topics_of_interest: interests.split(',').map(s => s.trim()).filter(Boolean),
      about_me_facts: facts.split('\n').map(s => s.trim()).filter(Boolean),
      custom_instructions: instructions.trim(),
    }
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setSaveMsg('Saved')
    setTimeout(() => setSaveMsg(''), 2500)
    if (profile && settings) {
      onSaved({ ...profile, name }, { ...settings, ...payload })
    }
  }, [name, tone, directness, warmth, respLength, emoji, headers, interests, facts, instructions, profile, settings, onSaved])

  const handleClearMemory = useCallback(async () => {
    if (!confirm('Delete all conversations? This cannot be undone.')) return
    const convs: { id: string }[] = await fetch('/api/conversations').then(r => r.json())
    await Promise.all(convs.map(c => fetch(`/api/conversations/${c.id}`, { method: 'DELETE' })))
    onClose()
    window.location.reload()
  }, [onClose])

  // ── Vault operations ───────────────────────────────────────────────────────

  const handleVaultSave = useCallback(async () => {
    const sd = (window as unknown as { samDesktop?: SamDesktop }).samDesktop
    if (!sd || !vaultKey.trim() || !vaultValue.trim()) return
    setVaultSaving(true)
    await sd.vault.set(vaultKey.trim(), vaultValue.trim())
    const keys = await sd.vault.keys()
    setVaultKeys(keys)
    setVaultKey('')
    setVaultValue('')
    setVaultMsg('Saved to vault')
    setTimeout(() => setVaultMsg(''), 2500)
    setVaultSaving(false)
  }, [vaultKey, vaultValue])

  const handleVaultReveal = useCallback(async (key: string) => {
    const sd = (window as unknown as { samDesktop?: SamDesktop }).samDesktop
    if (!sd) return
    if (revealedKey === key) {
      setRevealedKey(null)
      setRevealedValue('')
      return
    }
    if (!confirm(`Reveal "${key}" from vault? This will show the value on screen.`)) return
    const value = await sd.vault.get(key)
    setRevealedKey(key)
    setRevealedValue(value ?? '(empty)')
    // Auto-hide after 15 seconds
    setTimeout(() => { setRevealedKey(null); setRevealedValue('') }, 15000)
  }, [revealedKey])

  const handleVaultDelete = useCallback(async (key: string) => {
    const sd = (window as unknown as { samDesktop?: SamDesktop }).samDesktop
    if (!sd) return
    if (!confirm(`Permanently delete "${key}" from vault?`)) return
    await sd.vault.delete(key)
    setVaultKeys(prev => prev.filter(k => k !== key))
    if (revealedKey === key) { setRevealedKey(null); setRevealedValue('') }
  }, [revealedKey])

  const handleVaultWipe = useCallback(async () => {
    const sd = (window as unknown as { samDesktop?: SamDesktop }).samDesktop
    if (!sd) return
    if (!confirm('Wipe ENTIRE local vault? All saved items will be permanently deleted. This cannot be undone.')) return
    if (!confirm('Are you absolutely sure? This deletes everything in the vault.')) return
    const keys = await sd.vault.keys()
    await Promise.all(keys.map(k => sd.vault.delete(k)))
    setVaultKeys([])
    setRevealedKey(null)
    setRevealedValue('')
    setVaultMsg('Vault wiped')
    setTimeout(() => setVaultMsg(''), 3000)
  }, [])

  // ── Memory operations ──────────────────────────────────────────────────────

  const loadMemories = useCallback(async () => {
    setMemLoading(true)
    const data: Memory[] = await fetch('/api/memory').then(r => r.json())
    setMemories(Array.isArray(data) ? data : [])
    setMemLoading(false)
  }, [])

  useEffect(() => {
    if (activeSection === 'memory') loadMemories()
  }, [activeSection, loadMemories])

  const handleSaveMemory = useCallback(async () => {
    if (!newMemContent.trim()) return
    setMemSaving(true)
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newMemType, content: newMemContent.trim() }),
    })
    setNewMemContent('')
    await loadMemories()
    setMemSaving(false)
  }, [newMemType, newMemContent, loadMemories])

  const handleDeleteMemory = useCallback(async (id: string) => {
    await fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setMemories(prev => prev.filter(m => m.id !== id))
  }, [])

  const handleClearAllMemories = useCallback(async () => {
    if (!confirm('Delete all memories? Sam will forget everything it has remembered. This cannot be undone.')) return
    await fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setMemories([])
  }, [])

  // ── Security operations ────────────────────────────────────────────────────

  const handleRevokeAllSessions = useCallback(async () => {
    if (!confirm('Sign out all sessions everywhere? You will need to log in again on all devices.')) return
    setRevoking(true)
    await fetch('/api/auth/revoke', { method: 'POST' })
    setRevoking(false)
    window.location.href = '/login'
  }, [])

  const handleEmergencyWipe = useCallback(async () => {
    if (!confirm('EMERGENCY WIPE: Delete ALL conversations and messages permanently?')) return
    if (!confirm('This cannot be undone. Confirm final time.')) return
    setWiping(true)
    const convs: { id: string }[] = await fetch('/api/conversations').then(r => r.json())
    await Promise.all(convs.map(c => fetch(`/api/conversations/${c.id}`, { method: 'DELETE' })))
    await fetch('/api/auth/revoke', { method: 'POST' })
    window.location.href = '/login'
  }, [])

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel">

        <div className="modal-nav">
          <div className="modal-nav-title">Settings</div>
          {SECTIONS.map(s => (
            <button
              key={s}
              className={`modal-nav-item${activeSection === s ? ' active' : ''}`}
              data-section={s}
              onClick={() => setActiveSection(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="modal-body">
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* General */}
          <div className={`modal-section${activeSection !== 'general' ? ' hidden' : ''}`}>
            <h2 className="section-title">General</h2>
            <div className="field-group">
              <label className="field-label">Your name</label>
              <p className="field-desc">How Sam refers to you.</p>
              <input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="field-group">
              <label className="field-label">Interests</label>
              <p className="field-desc">Comma-separated topics Sam can bring up naturally.</p>
              <input className="field-input" value={interests} onChange={e => setInterests(e.target.value)} placeholder="e.g. music, running, tech" />
            </div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>Save changes</button>
            <span className="save-confirm">{saveMsg}</span>
          </div>

          {/* Personalization */}
          <div className={`modal-section${activeSection !== 'personalization' ? ' hidden' : ''}`}>
            <h2 className="section-title">Personalization</h2>
            <div className="field-row">
              <div className="field-group">
                <label className="field-label">Tone</label>
                <p className="field-desc">Overall communication style.</p>
                <select className="field-select" value={tone} onChange={e => setTone(e.target.value)}>
                  <option value="casual and warm">Casual &amp; warm</option>
                  <option value="friendly and professional">Friendly &amp; professional</option>
                  <option value="direct and concise">Direct &amp; concise</option>
                  <option value="playful and witty">Playful &amp; witty</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Directness</label>
                <select className="field-select" value={directness} onChange={e => setDirectness(e.target.value)}>
                  <option value="balanced">Balanced</option>
                  <option value="very direct">Very direct</option>
                  <option value="gentle and contextual">Gentle &amp; contextual</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field-group">
                <label className="field-label">Warmth</label>
                <select className="field-select" value={warmth} onChange={e => setWarmth(e.target.value)}>
                  <option value="warm">Warm</option>
                  <option value="neutral">Neutral</option>
                  <option value="very warm">Very warm</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Response length</label>
                <select className="field-select" value={respLength} onChange={e => setRespLength(e.target.value)}>
                  <option value="concise">Concise</option>
                  <option value="moderate">Moderate</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field-group toggle-group">
                <div className="toggle-label-wrap">
                  <label className="field-label">Use emoji</label>
                  <p className="field-desc">Sam occasionally uses emoji.</p>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={emoji} onChange={e => setEmoji(e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>
              <div className="field-group toggle-group">
                <div className="toggle-label-wrap">
                  <label className="field-label">Headers &amp; lists</label>
                  <p className="field-desc">Use markdown in longer answers.</p>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={headers} onChange={e => setHeaders(e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">About you</label>
              <p className="field-desc">Facts Sam should always know about you. One per line.</p>
              <textarea className="field-textarea" rows={4} value={facts} onChange={e => setFacts(e.target.value)} placeholder={"I live in Denver\nI have two dogs"} />
            </div>
            <div className="field-group">
              <label className="field-label">Custom instructions</label>
              <p className="field-desc">Tell Sam how to respond. Applied to every conversation.</p>
              <textarea className="field-textarea" rows={4} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="e.g. Be direct. Challenge my assumptions. Never sugarcoat." />
            </div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>Save changes</button>
            <span className="save-confirm">{saveMsg}</span>
          </div>

          {/* Memory */}
          <div className={`modal-section${activeSection !== 'memory' ? ' hidden' : ''}`}>
            <h2 className="section-title">Memory</h2>
            <p className="section-desc">Sam remembers important things across conversations. You can view, add, or delete memories here.</p>

            {/* Add memory manually */}
            <div className="field-group" style={{ marginTop: 24 }}>
              <label className="field-label">Add a memory</label>
              <p className="field-desc">Manually tell Sam something to remember.</p>
              <div className="memory-add-form">
                <select
                  className="field-select"
                  value={newMemType}
                  onChange={e => setNewMemType(e.target.value as Memory['type'])}
                >
                  <option value="general">Personal</option>
                  <option value="project">Project</option>
                  <option value="preference">Preference</option>
                  <option value="task">Task</option>
                </select>
                <input
                  className="field-input"
                  placeholder="e.g. I prefer short responses and no bullet points"
                  value={newMemContent}
                  onChange={e => setNewMemContent(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveMemory() }}
                />
                <button
                  className="btn-primary"
                  onClick={handleSaveMemory}
                  disabled={memSaving || !newMemContent.trim()}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Memory list */}
            <div className="field-group" style={{ marginTop: 24 }}>
              <label className="field-label">
                Saved memories {memories.length > 0 ? `(${memories.length})` : ''}
              </label>
              {memLoading ? (
                <p className="field-desc">Loading…</p>
              ) : memories.length === 0 ? (
                <p className="field-desc">No memories yet. Sam will start saving things as you chat.</p>
              ) : (
                <div className="memory-list">
                  {(['task', 'project', 'preference', 'general'] as Memory['type'][]).map(type => {
                    const group = memories.filter(m => m.type === type)
                    if (!group.length) return null
                    const labels: Record<Memory['type'], string> = {
                      task:       'Current tasks',
                      project:    'Projects & decisions',
                      preference: 'Preferences',
                      general:    'Personal',
                    }
                    return (
                      <div key={type} className="memory-group">
                        <div className="memory-group-label">{labels[type]}</div>
                        {group.map(m => (
                          <div key={m.id} className="memory-item">
                            <span className="memory-item-content">{m.content}</span>
                            <button
                              className="memory-item-delete"
                              onClick={() => handleDeleteMemory(m.id)}
                              title="Forget this"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Danger zone */}
            <div className="field-group" style={{ marginTop: 28 }}>
              <label className="field-label">Clear all memories</label>
              <p className="field-desc">Sam will forget everything it has remembered. Conversation history is not affected.</p>
              <button className="btn-danger" onClick={handleClearAllMemories} disabled={memories.length === 0}>
                Clear all memories
              </button>
            </div>

            <div className="field-group" style={{ marginTop: 16 }}>
              <label className="field-label">Clear all conversations</label>
              <p className="field-desc">Permanently delete every conversation and start fresh.</p>
              <button className="btn-danger" onClick={handleClearMemory}>Delete all conversations</button>
            </div>
          </div>

          {/* Security */}
          <div className={`modal-section${activeSection !== 'security' ? ' hidden' : ''}`}>
            <h2 className="section-title">Security</h2>

            {/* Vault — desktop only */}
            {isDesktop ? (
              <>
                <div className="field-group">
                  <label className="field-label">Local Vault</label>
                  <p className="field-desc">
                    Vault items are encrypted locally using your OS keychain (Windows DPAPI).
                    They never leave your device and are never sent to Sam or OpenAI.
                  </p>
                </div>

                <div className="vault-add-form">
                  <input
                    className="field-input"
                    placeholder="Item name (e.g. Netflix recovery code)"
                    value={vaultKey}
                    onChange={e => setVaultKey(e.target.value)}
                  />
                  <input
                    className="field-input"
                    placeholder="Value"
                    type="password"
                    value={vaultValue}
                    onChange={e => setVaultValue(e.target.value)}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleVaultSave}
                    disabled={vaultSaving || !vaultKey.trim() || !vaultValue.trim()}
                  >
                    Save to Vault
                  </button>
                  {vaultMsg && <span className="save-confirm">{vaultMsg}</span>}
                </div>

                {vaultKeys.length > 0 && (
                  <div className="vault-list">
                    <p className="field-label" style={{ marginBottom: 8 }}>Stored items ({vaultKeys.length})</p>
                    {vaultKeys.map(key => (
                      <div key={key} className="vault-item">
                        <span className="vault-item-key">🔒 {key}</span>
                        {revealedKey === key && (
                          <span className="vault-item-value">{revealedValue}</span>
                        )}
                        <div className="vault-item-actions">
                          <button
                            className="msg-action-btn"
                            onClick={() => handleVaultReveal(key)}
                          >
                            {revealedKey === key ? 'Hide' : 'Reveal'}
                          </button>
                          <button
                            className="msg-action-btn"
                            onClick={() => handleVaultDelete(key)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="field-group" style={{ marginTop: 24 }}>
                  <label className="field-label">Wipe vault</label>
                  <p className="field-desc">Permanently delete all items from your local vault.</p>
                  <button className="btn-danger" onClick={handleVaultWipe}>Wipe entire vault</button>
                </div>
              </>
            ) : (
              <div className="field-group">
                <label className="field-label">Local Vault</label>
                <p className="field-desc">The encrypted local vault is only available in Sam Desktop.</p>
              </div>
            )}

            {/* Session revocation */}
            <div className="field-group" style={{ marginTop: 28 }}>
              <label className="field-label">Revoke all sessions</label>
              <p className="field-desc">
                Signs you out on every device immediately. Use this if you suspect your account has been compromised.
              </p>
              <button className="btn-danger" onClick={handleRevokeAllSessions} disabled={revoking}>
                {revoking ? 'Revoking…' : 'Sign out all sessions'}
              </button>
            </div>

            {/* Emergency wipe */}
            <div className="field-group" style={{ marginTop: 16 }}>
              <label className="field-label">Emergency wipe</label>
              <p className="field-desc">
                Deletes all conversations and messages, then signs out all sessions.
                Use only in an emergency. This cannot be undone.
              </p>
              <button className="btn-danger" onClick={handleEmergencyWipe} disabled={wiping}>
                {wiping ? 'Wiping…' : 'Emergency wipe everything'}
              </button>
            </div>
          </div>

          {/* Account */}
          <div className={`modal-section${activeSection !== 'account' ? ' hidden' : ''}`}>
            <h2 className="section-title">Account</h2>
            <p className="section-desc">Your data is stored in your private Supabase database. Nothing is shared.</p>
            <div className="field-group" style={{ marginTop: 28 }}>
              <label className="field-label">AI provider</label>
              <p className="field-desc">Currently using <strong>OpenAI GPT-4o</strong>.</p>
            </div>
            <div className="field-group">
              <button className="btn-danger" onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                window.location.href = '/login'
              }}>Sign out</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
