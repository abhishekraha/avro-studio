import { useState, useCallback, useRef, useEffect } from 'react';
import type { AvroProtocol, AvroRecordType, AvroField, AvroSchemaType } from '../../core/types/schema';
import { isRecordType } from '../../core/types/schema';

export interface MoveFieldParams {
  sourceRecordName: string;
  targetRecordName: string;
  fieldId: string;
  targetIndex?: number;
}

export interface SchemaStateOptions {
  initialProtocol?: AvroProtocol | null;
  onAutoSave?: (protocol: AvroProtocol) => void;
  debounceMs?: number;
}

export interface UseSchemaStateReturn {
  original: AvroProtocol | null;
  edited: AvroProtocol | null;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  setProtocol: (protocol: AvroProtocol | null) => void;
  addField: (recordName: string, field: Omit<AvroField, 'id'> & { id?: string }, index?: number) => void;
  removeField: (recordName: string, fieldId: string) => void;
  renameField: (recordName: string, fieldId: string, newName: string) => void;
  updateFieldType: (recordName: string, fieldId: string, newType: AvroSchemaType) => void;
  updateFieldDoc: (recordName: string, fieldId: string, newDoc?: string) => void;
  updateFieldDefault: (recordName: string, fieldId: string, newDefault: unknown) => void;
  moveField: (params: MoveFieldParams) => void;
  reorderField: (recordName: string, oldIndex: number, newIndex: number) => void;
  addRecord: (recordName: string, namespace?: string, doc?: string) => void;
  removeRecord: (recordName: string) => void;
  renameRecord: (oldName: string, newName: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

/**
 * Pure state reducer / manager for Avro schema operations.
 * Can be used standalone or wrapped in React hook.
 */
export class SchemaStateManager {
  private original: AvroProtocol | null = null;
  private current: AvroProtocol | null = null;
  private history: AvroProtocol[] = [];
  private historyIndex: number = -1;
  private idCounter = 1;

  constructor(initial?: AvroProtocol | null) {
    if (initial) {
      this.original = structuredClone(initial);
      this.current = structuredClone(initial);
      this.history = [structuredClone(initial)];
      this.historyIndex = 0;
    }
  }

  public getOriginal(): AvroProtocol | null {
    return this.original;
  }

  public getCurrent(): AvroProtocol | null {
    return this.current;
  }

  public canUndo(): boolean {
    return this.historyIndex > 0;
  }

  public canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  public isDirty(): boolean {
    if (!this.original || !this.current) return false;
    return JSON.stringify(this.original) !== JSON.stringify(this.current);
  }

  private generateId(): string {
    return `f-${Date.now()}-${this.idCounter++}`;
  }

  private pushState(next: AvroProtocol): void {
    const clone = structuredClone(next);
    // Truncate redo stack
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(clone);
    this.historyIndex++;
    this.current = clone;
  }

  public setProtocol(protocol: AvroProtocol | null): void {
    if (!protocol) {
      this.original = null;
      this.current = null;
      this.history = [];
      this.historyIndex = -1;
      return;
    }
    const clone = structuredClone(protocol);
    this.original = structuredClone(protocol);
    this.current = clone;
    this.history = [clone];
    this.historyIndex = 0;
  }

  public addField(
    recordName: string,
    fieldData: Omit<AvroField, 'id'> & { id?: string },
    index?: number
  ): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as AvroRecordType | undefined;
    if (!rec) return;

    const newField: AvroField = {
      ...fieldData,
      id: fieldData.id || this.generateId(),
    };

    if (index !== undefined && index >= 0 && index <= rec.fields.length) {
      rec.fields.splice(index, 0, newField);
    } else {
      rec.fields.push(newField);
    }

    this.pushState(next);
  }

  public removeField(recordName: string, fieldId: string): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as AvroRecordType | undefined;
    if (!rec) return;

    rec.fields = rec.fields.filter((f) => f.id !== fieldId);
    this.pushState(next);
  }

  public renameField(recordName: string, fieldId: string, newName: string): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as AvroRecordType | undefined;
    if (!rec) return;

    const targetField = rec.fields.find((f) => f.id === fieldId);
    if (!targetField) return;

    targetField.name = newName;
    this.pushState(next);
  }

  public updateFieldType(recordName: string, fieldId: string, newType: AvroSchemaType): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as AvroRecordType | undefined;
    if (!rec) return;

    const targetField = rec.fields.find((f) => f.id === fieldId);
    if (!targetField) return;

    targetField.type = newType;
    this.pushState(next);
  }

  public updateFieldDoc(recordName: string, fieldId: string, newDoc?: string): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as AvroRecordType | undefined;
    if (!rec) return;

    const targetField = rec.fields.find((f) => f.id === fieldId);
    if (!targetField) return;

    if (newDoc) {
      targetField.doc = newDoc;
    } else {
      delete targetField.doc;
    }
    this.pushState(next);
  }

  public updateFieldDefault(recordName: string, fieldId: string, newDefault: unknown): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as AvroRecordType | undefined;
    if (!rec) return;

    const targetField = rec.fields.find((f) => f.id === fieldId);
    if (!targetField) return;

    if (newDefault !== undefined) {
      targetField.default = newDefault;
    } else {
      delete targetField.default;
    }
    this.pushState(next);
  }

  public moveField(params: MoveFieldParams): void {
    const { sourceRecordName, targetRecordName, fieldId, targetIndex } = params;
    if (!this.current) return;
    const next = structuredClone(this.current);

    const sourceRec = next.types.find(
      (t) => isRecordType(t) && t.name === sourceRecordName
    ) as AvroRecordType | undefined;
    const targetRec = next.types.find(
      (t) => isRecordType(t) && t.name === targetRecordName
    ) as AvroRecordType | undefined;

    if (!sourceRec || !targetRec) return;

    const fieldIdx = sourceRec.fields.findIndex((f) => f.id === fieldId);
    if (fieldIdx === -1) return;

    const [field] = sourceRec.fields.splice(fieldIdx, 1);

    if (sourceRecordName === targetRecordName) {
      const dest = targetIndex !== undefined ? targetIndex : sourceRec.fields.length;
      sourceRec.fields.splice(dest, 0, field);
    } else {
      const dest = targetIndex !== undefined ? targetIndex : targetRec.fields.length;
      targetRec.fields.splice(dest, 0, field);
    }

    this.pushState(next);
  }

  public reorderField(recordName: string, oldIndex: number, newIndex: number): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as AvroRecordType | undefined;
    if (!rec) return;

    if (oldIndex < 0 || oldIndex >= rec.fields.length) return;
    if (newIndex < 0 || newIndex >= rec.fields.length) return;

    const [moved] = rec.fields.splice(oldIndex, 1);
    rec.fields.splice(newIndex, 0, moved);

    this.pushState(next);
  }

  public addRecord(recordName: string, namespace?: string, doc?: string): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    const newRecord: AvroRecordType = {
      type: 'record',
      name: recordName,
      ...(namespace ? { namespace } : {}),
      ...(doc ? { doc } : {}),
      fields: [],
    };
    next.types.push(newRecord);
    this.pushState(next);
  }

  public removeRecord(recordName: string): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    next.types = next.types.filter((t) => t.name !== recordName);
    this.pushState(next);
  }

  public renameRecord(oldName: string, newName: string): void {
    if (!this.current) return;
    const next = structuredClone(this.current);
    const rec = next.types.find((t) => t.name === oldName);
    if (rec) {
      rec.name = newName;
      this.pushState(next);
    }
  }

  public undo(): void {
    if (this.canUndo()) {
      this.historyIndex--;
      this.current = structuredClone(this.history[this.historyIndex]);
    }
  }

  public redo(): void {
    if (this.canRedo()) {
      this.historyIndex++;
      this.current = structuredClone(this.history[this.historyIndex]);
    }
  }

  public reset(): void {
    if (this.original) {
      this.current = structuredClone(this.original);
      this.history = [structuredClone(this.original)];
      this.historyIndex = 0;
    }
  }
}

/**
 * React 19 hook for managing schema state with undo/redo and autosave.
 */
export function useSchemaState(options: SchemaStateOptions = {}): UseSchemaStateReturn {
  const { initialProtocol = null, onAutoSave, debounceMs = 1000 } = options;

  const [original, setOriginal] = useState<AvroProtocol | null>(() =>
    initialProtocol ? structuredClone(initialProtocol) : null
  );
  const [history, setHistory] = useState<AvroProtocol[]>(() =>
    initialProtocol ? [structuredClone(initialProtocol)] : []
  );
  const [historyIndex, setHistoryIndex] = useState<number>(() =>
    initialProtocol ? 0 : -1
  );

  const edited = historyIndex >= 0 && historyIndex < history.length ? history[historyIndex] : null;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const isDirty = original && edited ? JSON.stringify(original) !== JSON.stringify(edited) : false;

  const idCounterRef = useRef(1);
  const generateId = useCallback(() => {
    return `f-${Date.now()}-${idCounterRef.current++}`;
  }, []);

  // Debounced auto-save effect
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!edited || !onAutoSave || !isDirty) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      onAutoSave(edited);
    }, debounceMs);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [edited, onAutoSave, debounceMs, isDirty]);

  const commitNextState = useCallback(
    (nextState: AvroProtocol) => {
      setHistory((prevHistory) => {
        const truncated = prevHistory.slice(0, historyIndex + 1);
        return [...truncated, structuredClone(nextState)];
      });
      setHistoryIndex((prevIndex) => prevIndex + 1);
    },
    [historyIndex]
  );

  const setProtocol = useCallback((protocol: AvroProtocol | null) => {
    if (!protocol) {
      setOriginal(null);
      setHistory([]);
      setHistoryIndex(-1);
      return;
    }
    const cloned = structuredClone(protocol);
    setOriginal(structuredClone(protocol));
    setHistory([cloned]);
    setHistoryIndex(0);
  }, []);

  const addField = useCallback(
    (recordName: string, fieldData: Omit<AvroField, 'id'> & { id?: string }, index?: number) => {
      if (!edited) return;
      const next = structuredClone(edited);
      const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as
        | AvroRecordType
        | undefined;
      if (!rec) return;

      const newField: AvroField = {
        ...fieldData,
        id: fieldData.id || generateId(),
      };

      if (index !== undefined && index >= 0 && index <= rec.fields.length) {
        rec.fields.splice(index, 0, newField);
      } else {
        rec.fields.push(newField);
      }

      commitNextState(next);
    },
    [edited, commitNextState, generateId]
  );

  const removeField = useCallback(
    (recordName: string, fieldId: string) => {
      if (!edited) return;
      const next = structuredClone(edited);
      const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as
        | AvroRecordType
        | undefined;
      if (!rec) return;

      rec.fields = rec.fields.filter((f) => f.id !== fieldId);
      commitNextState(next);
    },
    [edited, commitNextState]
  );

  const renameField = useCallback(
    (recordName: string, fieldId: string, newName: string) => {
      if (!edited) return;
      const next = structuredClone(edited);
      const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as
        | AvroRecordType
        | undefined;
      if (!rec) return;

      const field = rec.fields.find((f) => f.id === fieldId);
      if (!field) return;

      field.name = newName;
      commitNextState(next);
    },
    [edited, commitNextState]
  );

  const updateFieldType = useCallback(
    (recordName: string, fieldId: string, newType: AvroSchemaType) => {
      if (!edited) return;
      const next = structuredClone(edited);
      const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as
        | AvroRecordType
        | undefined;
      if (!rec) return;

      const field = rec.fields.find((f) => f.id === fieldId);
      if (!field) return;

      field.type = newType;
      commitNextState(next);
    },
    [edited, commitNextState]
  );

  const updateFieldDoc = useCallback(
    (recordName: string, fieldId: string, newDoc?: string) => {
      if (!edited) return;
      const next = structuredClone(edited);
      const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as
        | AvroRecordType
        | undefined;
      if (!rec) return;

      const field = rec.fields.find((f) => f.id === fieldId);
      if (!field) return;

      if (newDoc) {
        field.doc = newDoc;
      } else {
        delete field.doc;
      }
      commitNextState(next);
    },
    [edited, commitNextState]
  );

  const updateFieldDefault = useCallback(
    (recordName: string, fieldId: string, newDefault: unknown) => {
      if (!edited) return;
      const next = structuredClone(edited);
      const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as
        | AvroRecordType
        | undefined;
      if (!rec) return;

      const field = rec.fields.find((f) => f.id === fieldId);
      if (!field) return;

      if (newDefault !== undefined) {
        field.default = newDefault;
      } else {
        delete field.default;
      }
      commitNextState(next);
    },
    [edited, commitNextState]
  );

  const moveField = useCallback(
    (params: MoveFieldParams) => {
      const { sourceRecordName, targetRecordName, fieldId, targetIndex } = params;
      if (!edited) return;
      const next = structuredClone(edited);

      const sourceRec = next.types.find(
        (t) => isRecordType(t) && t.name === sourceRecordName
      ) as AvroRecordType | undefined;
      const targetRec = next.types.find(
        (t) => isRecordType(t) && t.name === targetRecordName
      ) as AvroRecordType | undefined;

      if (!sourceRec || !targetRec) return;

      const fieldIdx = sourceRec.fields.findIndex((f) => f.id === fieldId);
      if (fieldIdx === -1) return;

      const [field] = sourceRec.fields.splice(fieldIdx, 1);

      if (sourceRecordName === targetRecordName) {
        const dest = targetIndex !== undefined ? targetIndex : sourceRec.fields.length;
        sourceRec.fields.splice(dest, 0, field);
      } else {
        const dest = targetIndex !== undefined ? targetIndex : targetRec.fields.length;
        targetRec.fields.splice(dest, 0, field);
      }

      commitNextState(next);
    },
    [edited, commitNextState]
  );

  const reorderField = useCallback(
    (recordName: string, oldIndex: number, newIndex: number) => {
      if (!edited) return;
      const next = structuredClone(edited);
      const rec = next.types.find((t) => isRecordType(t) && t.name === recordName) as
        | AvroRecordType
        | undefined;
      if (!rec) return;

      if (oldIndex < 0 || oldIndex >= rec.fields.length) return;
      if (newIndex < 0 || newIndex >= rec.fields.length) return;

      const [moved] = rec.fields.splice(oldIndex, 1);
      rec.fields.splice(newIndex, 0, moved);

      commitNextState(next);
    },
    [edited, commitNextState]
  );

  const addRecord = useCallback(
    (recordName: string, namespace?: string, doc?: string) => {
      if (!edited) return;
      const next = structuredClone(edited);
      const newRecord: AvroRecordType = {
        type: 'record',
        name: recordName,
        ...(namespace ? { namespace } : {}),
        ...(doc ? { doc } : {}),
        fields: [],
      };
      next.types.push(newRecord);
      commitNextState(next);
    },
    [edited, commitNextState]
  );

  const removeRecord = useCallback(
    (recordName: string) => {
      if (!edited) return;
      const next = structuredClone(edited);
      next.types = next.types.filter((t) => t.name !== recordName);
      commitNextState(next);
    },
    [edited, commitNextState]
  );

  const renameRecord = useCallback(
    (oldName: string, newName: string) => {
      if (!edited) return;
      const next = structuredClone(edited);
      const rec = next.types.find((t) => t.name === oldName);
      if (rec) {
        rec.name = newName;
        commitNextState(next);
      }
    },
    [edited, commitNextState]
  );

  const undo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex((prev) => prev - 1);
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex((prev) => prev + 1);
    }
  }, [canRedo]);

  const reset = useCallback(() => {
    if (original) {
      setHistory([structuredClone(original)]);
      setHistoryIndex(0);
    }
  }, [original]);

  return {
    original,
    edited,
    canUndo,
    canRedo,
    isDirty,
    setProtocol,
    addField,
    removeField,
    renameField,
    updateFieldType,
    updateFieldDoc,
    updateFieldDefault,
    moveField,
    reorderField,
    addRecord,
    removeRecord,
    renameRecord,
    undo,
    redo,
    reset,
  };
}
