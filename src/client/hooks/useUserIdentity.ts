import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

export const USER_STORAGE_KEY = 'avro_user_id';

export interface UseUserIdentityReturn {
  userId: string | null;
  setUserId: (id: string) => void;
  clearUserId: () => void;
  isInitialized: boolean;
}

export class UserIdentityManager {
  private currentUserId: string | null = null;
  private initialized: boolean = false;
  private listeners = new Set<(userId: string | null) => void>();

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(USER_STORAGE_KEY);
        this.currentUserId = stored ? stored.trim() || null : null;
      } catch {
        this.currentUserId = null;
      }
    } else if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(USER_STORAGE_KEY);
        this.currentUserId = stored ? stored.trim() || null : null;
      } catch {
        this.currentUserId = null;
      }
    }
    this.initialized = true;
  }

  get userId(): string | null {
    return this.currentUserId;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  setUserId(id: string): void {
    const trimmed = id.trim();
    if (!trimmed) {
      return;
    }
    this.currentUserId = trimmed;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(USER_STORAGE_KEY, trimmed);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(USER_STORAGE_KEY, trimmed);
      }
    } catch {
      // ignore storage quota / access errors
    }
    this.notify();
  }

  clearUserId(): void {
    this.currentUserId = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(USER_STORAGE_KEY);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
    this.notify();
  }

  subscribe(listener: (userId: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentUserId);
    }
  }
}

// Global singleton instance for sync across app
export const globalUserIdentity = new UserIdentityManager();

/**
 * React hook to access and manage the user identity stored in localStorage.
 */
export function useUserIdentity(): UseUserIdentityReturn {
  const [userId, setLocalUserId] = useState<string | null>(() => globalUserIdentity.userId);
  const [isInitialized, setIsInitialized] = useState<boolean>(() => globalUserIdentity.isInitialized);

  useEffect(() => {
    // Initial sync
    setLocalUserId(globalUserIdentity.userId);
    setIsInitialized(globalUserIdentity.isInitialized);

    const unsubscribe = globalUserIdentity.subscribe((newId) => {
      setLocalUserId(newId);
    });

    // Also handle window storage events across tabs
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === USER_STORAGE_KEY) {
        const newVal = event.newValue ? event.newValue.trim() || null : null;
        if (newVal) {
          globalUserIdentity.setUserId(newVal);
        } else {
          globalUserIdentity.clearUserId();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }, []);

  const setUserId = useCallback((id: string) => {
    globalUserIdentity.setUserId(id);
  }, []);

  const clearUserId = useCallback(() => {
    globalUserIdentity.clearUserId();
  }, []);

  return {
    userId,
    setUserId,
    clearUserId,
    isInitialized,
  };
}
