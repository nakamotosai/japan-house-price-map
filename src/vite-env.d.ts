/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROTOMAPS_PM_TILES_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
