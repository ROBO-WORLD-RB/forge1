/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly GEMINI_API_KEY: string;
  readonly VITE_AI_PROVIDER?: 'openrouter' | 'gemini' | 'ollama';
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_OLLAMA_URL?: string;
  readonly VITE_OLLAMA_MODEL?: string;
  readonly VITE_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
