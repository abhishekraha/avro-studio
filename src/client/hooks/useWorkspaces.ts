import { useState, useEffect, useCallback, useMemo } from 'react';
import type { WorkspaceData } from '../../core/types/workspace';
import { useUserIdentity } from './useUserIdentity';

export interface WorkspaceMeta {
  id: string;
  name: string;
  savedAt: string;
}

export function useWorkspaces(explicitUserId?: string | null) {
  const { userId: contextUserId } = useUserIdentity();
  const effectiveUserId = explicitUserId !== undefined ? explicitUserId : contextUserId;

  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo<Record<string, string>>(() => {
    return {
      'X-User-Id': effectiveUserId || '',
    };
  }, [effectiveUserId]);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces', {
        headers: {
          ...authHeaders,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to load workspaces: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.workspaces)) {
        setWorkspaces(data.workspaces);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  const loadWorkspace = useCallback(async (id: string): Promise<WorkspaceData | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}`, {
        headers: {
          ...authHeaders,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to load workspace: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success && data.workspace) {
        setCurrentWorkspace(data.workspace);
        return data.workspace;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  const saveWorkspace = useCallback(async (data: WorkspaceData): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error(`Failed to save workspace: ${res.statusText}`);
      }
      const resData = await res.json();
      if (resData.success) {
        setCurrentWorkspace(data);
        await fetchWorkspaces();
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [authHeaders, fetchWorkspaces]);

  const deleteWorkspace = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to delete workspace: ${res.statusText}`);
      }
      if (currentWorkspace?.id === id) {
        setCurrentWorkspace(null);
      }
      await fetchWorkspaces();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [authHeaders, currentWorkspace, fetchWorkspaces]);

  const renameWorkspace = useCallback(async (id: string, newName: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) {
        throw new Error(`Failed to rename workspace: ${res.statusText}`);
      }
      if (currentWorkspace?.id === id) {
        setCurrentWorkspace((prev) => (prev ? { ...prev, name: newName } : null));
      }
      await fetchWorkspaces();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [authHeaders, currentWorkspace, fetchWorkspaces]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    isLoading,
    error,
    fetchWorkspaces,
    loadWorkspace,
    saveWorkspace,
    deleteWorkspace,
    renameWorkspace,
  };
}
