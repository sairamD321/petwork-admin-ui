/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Fills `{version}` in blueprint API paths. Defaults to v1. */
  readonly VITE_API_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
