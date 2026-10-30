import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseAvdl } from '@/core/parser/avdlParser';
import { serializeToAvdl } from '@/core/serializer/avdlSerializer';
import { computeDiff } from '@/core/utils/schemaDiff';
import { generateBqSchema } from '@/core/utils/bqSchemaGenerator';
import { buildLinkageExport } from '@/core/utils/exportLinkages';
import { runRecon } from '@/core/utils/reconEngine';
import { createDatabase, type AppDatabase } from '@/server/db/client';
import { WorkspaceRepository } from '@/server/db/workspaceRepository';
import { createApp, type AppInstance } from '@/server/app';
import { createDefaultWorkspace, type WorkspaceData } from '@/core/types/workspace';
import type { AvroProtocol, AvroRecordType } from '@/core/types/schema';

describe('End-to-End Smoke & Integration Flow', () => {
  let dbContext: AppDatabase;
  let repo: WorkspaceRepository;
  let app: AppInstance;

  beforeEach(() => {
    dbContext = createDatabase(':memory:');
    repo = new WorkspaceRepository(dbContext);
    app = createApp({ repo });
  });

  afterEach(() => {
    if (dbContext?.sqlite?.open) {
      dbContext.sqlite.close();
    }
  });

  it('runs complete end-to-end lifecycle: parse -> save -> load -> diff -> bq -> recon -> serialize', async () => {
    // 1. Parse AVDL schema
    const originalAvdl = `
      @namespace("com.example.analytics")
      @schemaVersion("1.0.0")
      protocol UserAnalyticsProtocol {
        record UserRecord {
          long id;
          string username;
          union { null, string } email = null;
        }
      }
    `;

    const parsedProtocol = parseAvdl(originalAvdl);
    expect(parsedProtocol.protocol).toBe('UserAnalyticsProtocol');
    expect(parsedProtocol.namespace).toBe('com.example.analytics');
    expect(parsedProtocol.types).toHaveLength(1);

    const userRecord = parsedProtocol.types[0] as AvroRecordType;
    expect(userRecord.name).toBe('UserRecord');
    expect(userRecord.fields).toHaveLength(3);

    // Create an edited version of the protocol with a renamed field and new field
    const editedProtocol: AvroProtocol = JSON.parse(JSON.stringify(parsedProtocol));
    const editedUserRecord = editedProtocol.types[0] as AvroRecordType;
    // Keep id field the same id
    editedUserRecord.fields[1] = {
      ...editedUserRecord.fields[1],
      name: 'full_name',
    };
    // Add a new score field
    editedUserRecord.fields.push({
      id: 'field-score-1',
      name: 'score',
      type: 'double',
      default: 0.0,
    });

    // 2. Save workspace to SQLite via WorkspaceRepository / API
    const workspaceId = 'e2e-ws-1';
    const initialWorkspace: WorkspaceData = {
      ...createDefaultWorkspace(workspaceId, 'E2E Analytics Workspace'),
      original: parsedProtocol,
      edited: editedProtocol,
    };

    const saveRes = await app.request('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialWorkspace),
    });
    expect(saveRes.status).toBe(200);
    const saveBody = await saveRes.json();
    expect(saveBody).toEqual({ success: true, id: workspaceId });

    // 3. Load workspace back from REST API
    const loadRes = await app.request(`/api/workspaces/${workspaceId}`);
    expect(loadRes.status).toBe(200);
    const loadBody = await loadRes.json();
    expect(loadBody.success).toBe(true);
    expect(loadBody.workspace.id).toBe(workspaceId);
    expect(loadBody.workspace.name).toBe('E2E Analytics Workspace');

    const loadedWorkspace = loadBody.workspace as WorkspaceData;
    expect(loadedWorkspace.original).toBeDefined();
    expect(loadedWorkspace.edited).toBeDefined();

    // 4. Compute schema diff
    const diff = computeDiff(loadedWorkspace.original, loadedWorkspace.edited);
    expect(diff.stats.renamedCount).toBe(1);
    expect(diff.stats.addedCount).toBe(1);
    expect(diff.stats.identicalCount).toBe(2); // 'id' and 'email' unchanged

    // 5. Export BigQuery schema from original and edited schemas
    const bqSchemaOriginal = generateBqSchema(loadedWorkspace.original!, 'UserRecord');
    expect(bqSchemaOriginal).toBeDefined();
    expect(bqSchemaOriginal).toContainEqual({
      name: 'id',
      type: 'INTEGER',
      mode: 'REQUIRED',
    });
    expect(bqSchemaOriginal).toContainEqual({
      name: 'username',
      type: 'STRING',
      mode: 'REQUIRED',
    });
    expect(bqSchemaOriginal).toContainEqual({
      name: 'email',
      type: 'STRING',
      mode: 'NULLABLE',
    });

    const bqSchemaEdited = generateBqSchema(loadedWorkspace.edited!, 'UserRecord');
    expect(bqSchemaEdited).toContainEqual({
      name: 'full_name',
      type: 'STRING',
      mode: 'REQUIRED',
    });
    expect(bqSchemaEdited).toContainEqual({
      name: 'score',
      type: 'FLOAT64',
      mode: 'REQUIRED',
    });

    // 6. Run Reconciliation engine between original source and edited target data
    const linkages = buildLinkageExport(
      loadedWorkspace.original!,
      loadedWorkspace.edited!,
      loadedWorkspace.manualLinks,
      loadedWorkspace.recordLinks
    );
    expect(linkages.linkages.length).toBeGreaterThan(0);

    const sourceData = [
      { id: 101, username: 'jdoe', email: 'jdoe@example.com' },
      { id: 102, username: 'asmith', email: 'asmith@example.com' },
    ];
    const targetData = [
      { id: 101, full_name: 'jdoe', email: 'jdoe@example.com', score: 98.5 },
      { id: 102, full_name: 'asmith', email: 'asmith@example.com', score: 85.0 },
    ];

    const reconReport = runRecon({
      sourceRows: sourceData,
      targetRows: targetData,
      keyFields: ['id'],
      linkages,
    });

    expect(reconReport.totalSourceRows).toBe(2);
    expect(reconReport.totalTargetRows).toBe(2);
    expect(reconReport.matchedRows).toBe(2);
    expect(reconReport.mismatchedRows).toHaveLength(0);
    expect(reconReport.missingInTarget).toHaveLength(0);
    expect(reconReport.extraInTarget).toHaveLength(0);

    // 7. Serialize back to AVDL
    const serializedAvdl = serializeToAvdl(loadedWorkspace.edited!);
    expect(serializedAvdl).toContain('@namespace("com.example.analytics")');
    expect(serializedAvdl).toContain('@schemaVersion("1.0.0")');
    expect(serializedAvdl).toContain('protocol UserAnalyticsProtocol {');
    expect(serializedAvdl).toContain('record UserRecord {');
    expect(serializedAvdl).toContain('string full_name;');
    expect(serializedAvdl).toContain('double score = 0;');

    // Verify serialized AVDL can be re-parsed without data loss
    const reParsed = parseAvdl(serializedAvdl);
    expect(reParsed.protocol).toBe('UserAnalyticsProtocol');
    expect(reParsed.namespace).toBe('com.example.analytics');
    const reParsedRecord = reParsed.types[0] as AvroRecordType;
    expect(reParsedRecord.name).toBe('UserRecord');
    expect(reParsedRecord.fields.map((f) => f.name)).toEqual(['id', 'full_name', 'email', 'score']);
  });
});
