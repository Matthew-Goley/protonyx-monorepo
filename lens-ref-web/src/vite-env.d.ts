/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Base URL of the referral service (referral-service/). Falls back to
  // http://localhost:8000 when unset. See src/lib/api.ts.
  readonly VITE_REFERRAL_API_URL?: string;

  // Base URL of the Fastify backend (backend/), which owns the `users` table
  // this site's login/signup authenticates against. Falls back to
  // http://localhost:3000 when unset. In production it MUST be
  // https://api.lens-arc.com so the session cookie stays same-site with
  // lens-arc.com. See src/lib/authApi.ts.
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
