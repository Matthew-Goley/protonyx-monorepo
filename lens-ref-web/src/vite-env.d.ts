/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Base URL of the referral service (referral-service/). Falls back to
  // http://localhost:8000 when unset. See src/lib/api.ts.
  readonly VITE_REFERRAL_API_URL?: string;

  // Base URL of the Fastify backend (backend/), which owns the `users` table
  // this site's login/signup authenticates against. Optional: falls back to
  // http://localhost:3000 in a dev build and https://api.lens-arc.com in a
  // production build. Any override for production must stay on
  // api.lens-arc.com so the session cookie stays same-site with lens-arc.com.
  // See src/lib/authApi.ts.
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
