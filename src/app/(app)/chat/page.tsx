import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatShell } from '@/components/ChatShell'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: conversations }, { data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
  ])

  return (
    <ChatShell
      initialConversations={conversations ?? []}
      initialProfile={profile}
      initialSettings={settings}
    />
  )
}
