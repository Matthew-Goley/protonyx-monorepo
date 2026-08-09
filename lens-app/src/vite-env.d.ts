/// <reference types="vite/client" />

// App version injected at build time by vite.config.ts `define` from package.json.
declare const __APP_VERSION__: string

// Every VITE_ var the app reads. Keep in lockstep with .env.example.
interface ImportMetaEnv {
  /** Fastify backend base URL. Falls back to http://localhost:3000 in @/lib/backend. */
  readonly VITE_API_URL?: string
  /** lens-api base URL (analytics engine). Read in @/api/lens. */
  readonly VITE_LENS_API_URL?: string
  /** lens-api X-API-Key. Inlined into the client bundle - not a secret, see @/api/lens. */
  readonly VITE_LENS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
