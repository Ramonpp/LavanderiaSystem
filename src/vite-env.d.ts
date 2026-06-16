/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_LG_CLIENT_ID?: string
  readonly VITE_LG_API_KEY?: string
  readonly VITE_LG_MESSAGE_ID?: string
  readonly VITE_LG_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
