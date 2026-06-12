import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase não configurado. Crie .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY',
  )
}

export const supabase = createClient(
  typeof url === 'string' && url.length > 0 ? url : 'https://placeholder.supabase.co',
  typeof anonKey === 'string' && anonKey.length > 0 ? anonKey : 'placeholder-anon-key',
)

