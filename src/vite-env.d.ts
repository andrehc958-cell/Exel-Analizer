/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BILLING_ENABLED?: string
  readonly VITE_PRO_PRICE_LABEL?: string
  readonly VITE_LEGAL_OWNER?: string
  readonly VITE_LEGAL_ADDRESS?: string
  readonly VITE_LEGAL_EMAIL?: string
  readonly VITE_LEGAL_JURISDICTION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
