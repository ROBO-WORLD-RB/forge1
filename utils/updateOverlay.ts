import { logger } from './logger';

export const UPDATE_OVERLAY_DELAY_MS = 400;
export const UPDATE_OVERLAY_ID = 'forge-update-overlay';

const OVERLAY_CLASSES = [
  'fixed inset-0 z-[99999] flex flex-col items-center justify-center',
  'bg-forge-navy text-white',
  'px-safe pt-safe pb-safe',
  'animate-in fade-in duration-200',
].join(' ');

/** Imperative full-screen overlay — paints before reload without waiting on React. */
export function showUpdateOverlay(): void {
  if (document.getElementById(UPDATE_OVERLAY_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = UPDATE_OVERLAY_ID;
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-label', 'Updating app');
  overlay.className = OVERLAY_CLASSES;

  overlay.innerHTML = `
    <div class="flex flex-col items-center justify-center gap-6 px-6 text-center max-w-sm">
      <img
        src="/logo.png"
        alt=""
        width="64"
        height="64"
        class="h-16 w-16 object-contain animate-pulse"
        onerror="this.style.display='none'"
      />
      <div class="space-y-2">
        <h1 class="text-xl font-semibold tracking-tight">Updating FORGE</h1>
        <p class="text-sm text-white/70">Getting the latest version for you…</p>
      </div>
      <div class="relative flex items-center justify-center">
        <div class="h-12 w-12 rounded-full border-2 border-white/20"></div>
        <div class="absolute h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-forge-orange"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const root = document.getElementById('root');
  if (root) {
    root.style.transition = 'opacity 200ms ease-out';
    root.style.opacity = '0';
  }
}

export function clearUpdateOverlay(): void {
  document.getElementById(UPDATE_OVERLAY_ID)?.remove();
  const root = document.getElementById('root');
  if (root) {
    root.style.opacity = '';
    root.style.transition = '';
  }
}

function waitForOverlayPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Show overlay, wait for paint + brief delay, then reload. Returns false if already reloaded this session. */
export async function reloadWithUpdateOverlay(
  reason: string,
  hasReloaded: () => boolean,
  markReloaded: (reason: string) => void
): Promise<boolean> {
  if (hasReloaded()) {
    logger.info('Skipping duplicate update reload', { reason }, 'AppUpdate');
    return false;
  }

  markReloaded(reason);
  logger.info('Reloading for app update', { reason }, 'AppUpdate');

  showUpdateOverlay();
  await waitForOverlayPaint();
  await new Promise((resolve) => setTimeout(resolve, UPDATE_OVERLAY_DELAY_MS));

  window.location.reload();
  return true;
}
