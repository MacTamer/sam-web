/**
 * sensitivity.ts — Sensitive content detection
 *
 * Scans message text before it's sent to the API.
 * If a match is found, the UI blocks the send and prompts the user.
 * The goal is to prevent accidental transmission of sensitive data to OpenAI.
 */

// Patterns that suggest vault-level sensitive content
const VAULT_PATTERNS: RegExp[] = [
  // Explicit labels
  /\b(password|passwd|pwd)\s*[:=\s]/i,
  /\b(pin|passcode)\s*[:=\s]*\d{4,}/i,
  /\bsecret\s*(key|token|code)\b/i,
  /\b(api[_\s]?key|access[_\s]?token|auth[_\s]?token)\b/i,
  /\b(recovery[_\s]?code|backup[_\s]?code|2fa[_\s]?code)\b/i,
  /\bseed[_\s]?phrase\b/i,
  /\bprivate[_\s]?key\b/i,
  /\bssn\b|\bsocial[_\s]?security\b/i,
  /\bcredit[_\s]?card\s*number\b/i,

  // High-entropy strings that look like keys/tokens (32+ hex or base64 chars)
  /\b[a-f0-9]{32,}\b/i,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/,

  // Common secret formats
  /sk-[a-zA-Z0-9]{20,}/,       // OpenAI key format
  /ghp_[a-zA-Z0-9]{36}/,       // GitHub personal access token
  /xox[baprs]-[0-9a-zA-Z-]+/,  // Slack token
]

export interface SensitivityResult {
  isSensitive: boolean
  reason:      string | null
}

export function checkSensitivity(text: string): SensitivityResult {
  for (const pattern of VAULT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isSensitive: true,
        reason:      getSensitivityReason(pattern),
      }
    }
  }
  return { isSensitive: false, reason: null }
}

function getSensitivityReason(pattern: RegExp): string {
  const src = pattern.source
  if (/password|passwd|pwd/.test(src))    return 'password'
  if (/pin|passcode/.test(src))           return 'PIN or passcode'
  if (/secret.*key|api.*key|token/.test(src)) return 'API key or token'
  if (/recovery|backup|2fa/.test(src))    return 'recovery or 2FA code'
  if (/seed|private.*key/.test(src))      return 'private key or seed phrase'
  if (/ssn|social.*security/.test(src))   return 'Social Security Number'
  if (/credit.*card/.test(src))           return 'credit card number'
  if (/sk-/.test(src))                    return 'API key'
  if (/ghp_/.test(src))                   return 'GitHub token'
  if (/xox/.test(src))                    return 'Slack token'
  return 'sensitive credential or key'
}
