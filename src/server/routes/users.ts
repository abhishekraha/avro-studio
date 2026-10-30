import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { users, workspaces } from '../db/schema';
import type { AppDatabase } from '../db/client';

// Regex: alphanumeric plus standard characters -, _, @
const HANDLE_REGEX = /^[a-zA-Z0-9_\-@]+$/;

const registerSchema = z.object({
  handle: z
    .string()
    .min(2, 'Handle must be at least 2 characters')
    .max(30, 'Handle must be at most 30 characters')
    .regex(HANDLE_REGEX, 'Handle can only contain letters, numbers, and - _ @'),
  currentHandle: z.string().optional(),
});

export function createUserRoutes(dbContext: AppDatabase) {
  const router = new Hono();

  // POST /api/users/claim - Claim or update a handle
  router.post('/claim', async (c) => {
    try {
      const body = await c.req.json();
      const parseResult = registerSchema.safeParse(body);

      if (!parseResult.success) {
        return c.json(
          {
            success: false,
            error: parseResult.error.errors[0]?.message || 'Invalid handle format',
          },
          400
        );
      }

      const { handle, currentHandle } = parseResult.data;

      // If user is renaming from existing handle
      if (currentHandle && currentHandle !== handle) {
        // Check if new handle is taken
        const existing = dbContext.db
          .select()
          .from(users)
          .where(eq(users.handle, handle))
          .get();

        if (existing) {
          return c.json(
            {
              success: false,
              error: `Handle "${handle}" is already taken by another user`,
            },
            409
          );
        }

        // Migrate workspaces and update user record inside a transaction
        dbContext.sqlite.transaction(() => {
          dbContext.db.insert(users).values({ handle }).run();
          dbContext.db
            .update(workspaces)
            .set({ userId: handle })
            .where(eq(workspaces.userId, currentHandle))
            .run();
          dbContext.db.delete(users).where(eq(users.handle, currentHandle)).run();
        })();

        return c.json({ success: true, handle });
      }

      // Check if handle already exists for fresh claim
      const existing = dbContext.db
        .select()
        .from(users)
        .where(eq(users.handle, handle))
        .get();

      if (existing) {
        // If it's already claimed by someone else
        return c.json(
          {
            success: false,
            error: `Handle "${handle}" is already taken by another user`,
          },
          409
        );
      }

      // Insert new handle
      dbContext.db.insert(users).values({ handle }).run();
      return c.json({ success: true, handle });
    } catch (err: unknown) {
      console.error('User claim error:', err);
      return c.json(
        {
          success: false,
          error: (err as Error).message || 'Failed to claim handle',
        },
        500
      );
    }
  });

  return router;
}
