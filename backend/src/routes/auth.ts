import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

function generateUsername(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return base.slice(0, 15) || 'user';
}

export function register(app: App, fastify: FastifyInstance) {
  // Hook to create profile after successful auth operations
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only process successful auth responses
    if (reply.statusCode !== 200 && reply.statusCode !== 201) {
      return;
    }

    // Check if this is a sign-up, sign-in, or other auth endpoint
    const isAuthEndpoint =
      request.url.includes('/api/auth/sign-up') ||
      request.url.includes('/api/auth/sign-in') ||
      request.url.includes('/api/auth/callback');

    if (!isAuthEndpoint) {
      return;
    }

    try {
      const session = await app.getSession(request);
      if (!session?.user?.id) {
        return;
      }

      const userId = session.user.id;

      // Check if profile already exists
      const [existingProfile] = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, userId));

      if (existingProfile) {
        return; // Profile already exists
      }

      // Generate unique username
      let username = generateUsername(session.user.email || '');

      // Ensure username is unique
      let attempt = 0;
      while (attempt < 100) {
        const [existing] = await app.db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.username, username));

        if (!existing) break;

        username = `${generateUsername(session.user.email || '')}${Math.floor(Math.random() * 10000)}`;
        attempt++;
      }

      app.logger.info({ userId, username, email: session.user.email }, 'Creating profile for new user');

      await app.db
        .insert(schema.profiles)
        .values({
          id: userId,
          username,
          role: 'user',
          avatarUrl: session.user.image || null,
        })
        .catch((err) => {
          app.logger.warn(
            { err, userId, username },
            'Profile creation failed (may already exist)'
          );
        });
    } catch (err) {
      app.logger.warn({ err }, 'Error in auth hook');
    }
  });
}
