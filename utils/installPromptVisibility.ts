/** Shared signal so floating UI (e.g. AI FAB) can yield to the PWA install prompt. */

type Listener = (visible: boolean) => void;

let installPromptVisible = false;
const listeners = new Set<Listener>();

export function setInstallPromptVisible(visible: boolean): void {
  if (installPromptVisible === visible) return;
  installPromptVisible = visible;
  listeners.forEach((listener) => listener(visible));
}

export function getInstallPromptVisible(): boolean {
  return installPromptVisible;
}

export function subscribeInstallPromptVisible(listener: Listener): () => void {
  listeners.add(listener);
  listener(installPromptVisible);
  return () => {
    listeners.delete(listener);
  };
}
