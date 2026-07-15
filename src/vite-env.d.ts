/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del backend que devuelve la roster de Teams vía Graph (opcional). */
  readonly VITE_ROSTER_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
