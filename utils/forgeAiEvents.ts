/** Cross-component events for opening Forge AI without importing the full chat UI. */

export const FORGE_AI_OPEN_EVENT = 'forge-ai-open';

export type ForgeAiOpenDetail = {
  intent?: 'match' | 'chat';
  prompt?: string;
};

export function openForgeAi(detail: ForgeAiOpenDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FORGE_AI_OPEN_EVENT, { detail }));
}
