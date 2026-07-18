import { useEffect, useSyncExternalStore } from 'react';
import { getUnreadNotificationCount } from '../services/notificationService';

type BadgeStore = {
  userId: string | null;
  count: number;
  inflight: Promise<void> | null;
  listeners: Set<() => void>;
};

const store: BadgeStore = {
  userId: null,
  count: 0,
  inflight: null,
  listeners: new Set(),
};

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

function getSnapshot(): number {
  return store.count;
}

function notifyListeners(): void {
  store.listeners.forEach((listener) => listener());
}

async function loadCount(userId: string): Promise<void> {
  if (store.inflight) {
    await store.inflight;
    return;
  }

  store.inflight = (async () => {
    const count = await getUnreadNotificationCount(userId);
    if (store.userId === userId) {
      store.count = count;
      notifyListeners();
    }
  })().finally(() => {
    store.inflight = null;
  });

  await store.inflight;
}

/** Shared unread badge count — one Supabase query per user session, not per nav bar. */
export function useUnreadNotificationCount(
  isAuthenticated: boolean,
  userId: string | undefined
): number {
  const count = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      store.userId = null;
      store.count = 0;
      notifyListeners();
      return;
    }

    if (store.userId !== userId) {
      store.userId = userId;
      store.count = 0;
      notifyListeners();
    }

    void loadCount(userId);
  }, [isAuthenticated, userId]);

  return count;
}
