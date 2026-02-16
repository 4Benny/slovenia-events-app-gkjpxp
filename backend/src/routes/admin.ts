import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function register(app: App, fastify: FastifyInstance) {
  // PUT /api/users/:id/role - Set user role (admin only)
  fastify.put(
    '/api/users/:id/role',
    {
      schema: {
        description: 'Set user role',
        tags: ['admin'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['user', 'organizer', 'admin'] },
          },
          required: ['role'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.getSession(request);
      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const [userProfile] = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, session.user.id));

      if (userProfile?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin only' });
      }

      const { id } = request.params as { id: string };
      const { role } = request.body as { role: string };

      app.logger.info({ targetUserId: id, role, adminId: session.user.id }, 'Setting user role');

      const [user] = await app.db.select().from(schema.profiles).where(eq(schema.profiles.id, id));

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      await app.db
        .update(schema.profiles)
        .set({ role: role as 'user' | 'organizer' | 'admin' })
        .where(eq(schema.profiles.id, id));

      app.logger.info({ targetUserId: id, role }, 'User role set successfully');
      return { success: true };
    }
  );

  // DELETE /api/events/:id/admin - Hard delete event (admin only)
  fastify.delete(
    '/api/events/:id/admin',
    {
      schema: {
        description: 'Hard delete event (admin)',
        tags: ['admin'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.getSession(request);
      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const [userProfile] = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, session.user.id));

      if (userProfile?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin only' });
      }

      const { id } = request.params as { id: string };
      app.logger.info({ eventId: id, adminId: session.user.id }, 'Admin hard delete event');

      const [event] = await app.db.select().from(schema.events).where(eq(schema.events.id, id));

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      // Cascade delete all related data
      await app.db.delete(schema.eventGoing).where(eq(schema.eventGoing.eventId, id));
      await app.db.delete(schema.eventComments).where(eq(schema.eventComments.eventId, id));
      await app.db.delete(schema.eventImages).where(eq(schema.eventImages.eventId, id));
      await app.db.delete(schema.eventRatings).where(eq(schema.eventRatings.eventId, id));
      await app.db.delete(schema.events).where(eq(schema.events.id, id));

      app.logger.info({ eventId: id }, 'Event hard deleted successfully');
      return { success: true };
    }
  );

  // POST /api/users/:id/ban - Ban user (admin only)
  fastify.post(
    '/api/users/:id/ban',
    {
      schema: {
        description: 'Ban user (admin)',
        tags: ['admin'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.getSession(request);
      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const [userProfile] = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, session.user.id));

      if (userProfile?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin only' });
      }

      const { id } = request.params as { id: string };
      app.logger.info({ targetUserId: id, adminId: session.user.id }, 'Banning user');

      const [user] = await app.db.select().from(schema.profiles).where(eq(schema.profiles.id, id));

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Hard delete all user data
      // Delete all related data first (cascade will handle some)
      await app.db.delete(schema.eventGoing).where(eq(schema.eventGoing.userId, id));
      await app.db.delete(schema.eventComments).where(eq(schema.eventComments.userId, id));
      await app.db.delete(schema.eventImages).where(eq(schema.eventImages.userId, id));
      await app.db.delete(schema.eventRatings).where(eq(schema.eventRatings.userId, id));
      await app.db.delete(schema.organizerFollows).where(eq(schema.organizerFollows.userId, id));

      // Delete organizer follows referencing this user
      await app.db.delete(schema.organizerFollows).where(eq(schema.organizerFollows.organizerId, id));

      // Delete events organized by this user (cascade will delete comments, images, ratings, going)
      await app.db.delete(schema.events).where(eq(schema.events.organizerId, id));

      // Delete reports by this user
      await app.db.delete(schema.reports).where(eq(schema.reports.reporterId, id));

      // Finally delete the profile
      await app.db.delete(schema.profiles).where(eq(schema.profiles.id, id));

      app.logger.info({ targetUserId: id }, 'User banned and all data deleted');
      return { success: true };
    }
  );
}
