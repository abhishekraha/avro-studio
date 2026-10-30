import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useUserIdentity, UserIdentityManager, USER_STORAGE_KEY } from '../../src/client/hooks/useUserIdentity';

describe('UserIdentityManager & useUserIdentity', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => (key in mockStorage ? mockStorage[key] : null),
      setItem: (key: string, value: string) => {
        mockStorage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with null userId if storage is empty', () => {
    const manager = new UserIdentityManager();
    expect(manager.isInitialized).toBe(true);
    expect(manager.userId).toBeNull();
  });

  it('reads existing userId from localStorage on initialization', () => {
    localStorage.setItem(USER_STORAGE_KEY, 'alice');
    const manager = new UserIdentityManager();
    expect(manager.isInitialized).toBe(true);
    expect(manager.userId).toBe('alice');
  });

  it('sets userId and updates localStorage', () => {
    const manager = new UserIdentityManager();
    let notifiedUser: string | null = null;
    manager.subscribe((id) => {
      notifiedUser = id;
    });

    manager.setUserId('bob');
    expect(manager.userId).toBe('bob');
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBe('bob');
    expect(notifiedUser).toBe('bob');
  });

  it('clears userId and removes from localStorage', () => {
    localStorage.setItem(USER_STORAGE_KEY, 'carol');
    const manager = new UserIdentityManager();
    expect(manager.userId).toBe('carol');

    let notifiedUser: string | null = 'carol';
    manager.subscribe((id) => {
      notifiedUser = id;
    });

    manager.clearUserId();
    expect(manager.userId).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();
    expect(notifiedUser).toBeNull();
  });

  it('trims whitespace and ignores empty string setUserId', () => {
    const manager = new UserIdentityManager();
    manager.setUserId('   ');
    expect(manager.userId).toBeNull();
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull();

    manager.setUserId('  dave  ');
    expect(manager.userId).toBe('dave');
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBe('dave');
  });
});
