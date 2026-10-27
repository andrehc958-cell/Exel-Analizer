/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BILLING_ENABLED?: string
  readonly VITE_PRO_PRICE_LABEL?: string
  readonly VITE_PRO_ANNUAL_PRICE_LABEL?: string
  readonly VITE_PRO_ANNUAL_NOTE?: string
  readonly VITE_PASS_PRICE_LABEL?: string
  readonly VITE_DONATION_URL?: string
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT?: string
  readonly VITE_AD_FRAME_URL?: string
  readonly VITE_LEGAL_OWNER?: string
  readonly VITE_LEGAL_ADDRESS?: string
  readonly VITE_LEGAL_EMAIL?: string
  readonly VITE_LEGAL_JURISDICTION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
