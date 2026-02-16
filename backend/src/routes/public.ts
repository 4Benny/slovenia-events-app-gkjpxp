import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, count, desc, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/organizers/:id - Get organizer profile (public)
  fastify.get(
    '/api/organizers/:id',
    {
      schema: {
        description: 'Get organizer profile',
        tags: ['organizers'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      app.logger.info({ organizerId: id }, 'Fetching organizer profile');

      const [organizer] = await app.db
        .select({
          id: schema.profiles.id,
          username: schema.profiles.username,
          role: schema.profiles.role,
          avatarUrl: schema.profiles.avatarUrl,
          region: schema.profiles.region,
          city: schema.profiles.city,
          showLocation: schema.profiles.showLocation,
          instagramUsername: schema.profiles.instagramUsername,
          snapchatUsername: schema.profiles.snapchatUsername,
          createdAt: schema.profiles.createdAt,
          eventCount: count(schema.events.id).as('event_count'),
        })
        .from(schema.profiles)
        .leftJoin(schema.events, eq(schema.profiles.id, schema.events.organizerId))
        .where(eq(schema.profiles.id, id))
        .groupBy(schema.profiles.id);

      if (!organizer) {
        return reply.status(404).send({ error: 'Organizer not found' });
      }

      if (organizer.role !== 'organizer') {
        return reply.status(404).send({ error: 'User is not an organizer' });
      }

      const result = {
        id: organizer.id,
        username: organizer.username,
        role: organizer.role,
        avatarUrl: organizer.avatarUrl,
        region: organizer.showLocation ? organizer.region : null,
        city: organizer.showLocation ? organizer.city : null,
        instagramUsername: organizer.instagramUsername,
        snapchatUsername: organizer.snapchatUsername,
        createdAt: organizer.createdAt,
        eventCount: organizer.eventCount,
      };

      app.logger.info({ organizerId: id }, 'Organizer profile fetched successfully');
      return result;
    }
  );

  // GET /api/users/:id - Get public user profile
  fastify.get(
    '/api/users/:id',
    {
      schema: {
        description: 'Get public user profile',
        tags: ['users'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      app.logger.info({ userId: id }, 'Fetching public user profile');

      const [user] = await app.db
        .select({
          id: schema.profiles.id,
          username: schema.profiles.username,
          role: schema.profiles.role,
          avatarUrl: schema.profiles.avatarUrl,
          createdAt: schema.profiles.createdAt,
        })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, id));

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const result = {
        id: user.id,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      };

      app.logger.info({ userId: id }, 'Public user profile fetched successfully');
      return result;
    }
  );

  // GET /api/organizers - Get all organizers (public)
  fastify.get(
    '/api/organizers',
    {
      schema: {
        description: 'Get all organizers',
        tags: ['organizers'],
        querystring: {
          type: 'object',
          properties: {
            region: { type: 'string' },
            city: { type: 'string' },
            search: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { region, city, search } = request.query as {
        region?: string;
        city?: string;
        search?: string;
      };

      app.logger.info({ region, city, search }, 'Fetching organizers');

      // Build where conditions
      const whereConditions = [eq(schema.profiles.role, 'organizer')];
      if (region) whereConditions.push(eq(schema.profiles.region, region));
      if (city) whereConditions.push(eq(schema.profiles.city, city));

      const organizers = await app.db
        .select({
          id: schema.profiles.id,
          username: schema.profiles.username,
          role: schema.profiles.role,
          avatarUrl: schema.profiles.avatarUrl,
          region: schema.profiles.region,
          city: schema.profiles.city,
          showLocation: schema.profiles.showLocation,
          instagramUsername: schema.profiles.instagramUsername,
          snapchatUsername: schema.profiles.snapchatUsername,
          createdAt: schema.profiles.createdAt,
          eventCount: count(schema.events.id).as('event_count'),
        })
        .from(schema.profiles)
        .leftJoin(schema.events, eq(schema.profiles.id, schema.events.organizerId))
        .where(and(...whereConditions))
        .groupBy(schema.profiles.id)
        .orderBy(desc(schema.profiles.createdAt));

      const result = organizers.map((org) => ({
        id: org.id,
        username: org.username,
        role: org.role,
        avatarUrl: org.avatarUrl,
        region: org.showLocation ? org.region : null,
        city: org.showLocation ? org.city : null,
        instagramUsername: org.instagramUsername,
        snapchatUsername: org.snapchatUsername,
        createdAt: org.createdAt,
        eventCount: org.eventCount,
      }));

      app.logger.info({ count: result.length }, 'Organizers fetched successfully');
      return result;
    }
  );
}
