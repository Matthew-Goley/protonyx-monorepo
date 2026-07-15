/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Base URL of the referral service (referral-service/). Falls back to
  // http://localhost:8000 when unset. See src/lib/api.ts.
  readonly VITE_REFERRAL_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
