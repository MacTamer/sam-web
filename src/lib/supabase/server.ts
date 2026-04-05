import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Partial<ResponseCookie> }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge:   60 * 60 * 24 * 30, // 30 days
                httpOnly: true,
                sameSite: 'lax',
                secure:   process.env.NODE_ENV === 'production',
              })
            )
          } catch {
            // Called from Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}
