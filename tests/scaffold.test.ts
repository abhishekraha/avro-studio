import { describe, it, expect } from 'vitest';
import React from 'react';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { z } from 'zod';

describe('Project Scaffolding', () => {
  it('loads React correctly', () => {
    expect(React).toBeDefined();
    expect(typeof React.createElement).toBe('function');
  });

  it('loads Hono server correctly', () => {
    const app = new Hono();
    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe('function');
  });

  it('loads Better-SQLite3 in-memory database correctly', () => {
    const db = new Database(':memory:');
    expect(db).toBeDefined();
    const row = db.prepare('SELECT 1 as val').get() as { val: number };
    expect(row.val).toBe(1);
    db.close();
  });

  it('loads Zod correctly', () => {
    const schema = z.object({ name: z.string() });
    const res = schema.safeParse({ name: 'Avro Studio' });
    expect(res.success).toBe(true);
  });
});
