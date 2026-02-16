import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

function validateUsername(username: string): boolean {
  return /^[a-z0-9_-]{3,}$/.test(username) && username === username.toLowerCase();
}

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/profile - Get own profile
  fastify.get(
    '/api/profile',
    {
      schema: {
        description: 'Get own profile',
        tags: ['profile'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.getSession(request);
      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      app.logger.info({ userId: session.user.id }, 'Fetching own profile');

      const [profile] = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, session.user.id));

      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      app.logger.info({ userId: session.user.id }, 'Profile fetched successfully');

      return {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
        region: profile.region,
        city: profile.city,
        showLocation: profile.showLocation,
        instagramUsername: profile.instagramUsername,
        snapchatUsername: profile.snapchatUsername,
        createdAt: profile.createdAt,
      };
    }
  );

  // PUT /api/profile - Update own profile
  fastify.put(
    '/api/profile',
    {
      schema: {
        description: 'Update own profile',
        tags: ['profile'],
        body: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            avatarUrl: { type: 'string' },
            region: { type: 'string' },
            city: { type: 'string' },
            showLocation: { type: 'boolean' },
            instagramUsername: { type: 'string' },
            snapchatUsername: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.getSession(request);
      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as any;
      app.logger.info({ userId: session.user.id, body }, 'Updating profile');

      const [profile] = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, session.user.id));

      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      if (body.username && body.username !== profile.username) {
        if (!validateUsername(body.username)) {
          return reply.status(400).send({ error: 'Username must be lowercase, 3+ chars, only a-z0-9_-' });
        }

        // Check if username is taken
        const [existing] = await app.db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.username, body.username.toLowerCase()));

        if (existing) {
          return reply.status(409).send({ error: 'Username already taken' });
        }
      }

      const [updated] = await app.db
        .update(schema.profiles)
        .set({
          username: body.username ? body.username.toLowerCase() : profile.username,
          avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : profile.avatarUrl,
          region: body.region !== undefined ? body.region : profile.region,
          city: body.city !== undefined ? body.city : profile.city,
          showLocation: body.showLocation !== undefined ? body.showLocation : profile.showLocation,
          instagramUsername: body.instagramUsername !== undefined ? body.instagramUsername : profile.instagramUsername,
          snapchatUsername: body.snapchatUsername !== undefined ? body.snapchatUsername : profile.snapchatUsername,
        })
        .where(eq(schema.profiles.id, session.user.id))
        .returning();

      app.logger.info({ userId: session.user.id }, 'Profile updated successfully');

      return {
        id: updated.id,
        username: updated.username,
        role: updated.role,
        avatarUrl: updated.avatarUrl,
        region: updated.region,
        city: updated.city,
        showLocation: updated.showLocation,
        instagramUsername: updated.instagramUsername,
        snapchatUsername: updated.snapchatUsername,
        createdAt: updated.createdAt,
      };
    }
  );

  // GET /api/profile/going - Get user's going events
  fastify.get(
    '/api/profile/going',
    {
      schema: {
        description: 'Get user going events',
        tags: ['profile'],
        querystring: {
          type: 'object',
          properties: {
            filter: { type: 'string', enum: ['upcoming', 'past'] },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.getSession(request);
      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { filter } = request.query as { filter?: string };
      app.logger.info({ userId: session.user.id, filter }, 'Fetching going events');

      const now = new Date();

      let events = await app.db
        .select({
          id: schema.events.id,
          title: schema.events.title,
          description: schema.events.description,
          lineup: schema.events.lineup,
          posterUrl: schema.events.posterUrl,
          region: schema.events.region,
          city: schema.events.city,
          address: schema.events.address,
          lat: schema.events.lat,
          lng: schema.events.lng,
          startsAt: schema.events.startsAt,
          endsAt: schema.events.endsAt,
          genre: schema.events.genre,
          ageLabel: schema.events.ageLabel,
          priceType: schema.events.priceType,
          price: schema.events.price,
          ticketUrl: schema.events.ticketUrl,
          status: schema.events.status,
          organizerId: schema.events.organizerId,
          organizerUsername: schema.profiles.username,
          organizerRole: schema.profiles.role,
        })
        .from(schema.eventGoing)
        .innerJoin(schema.events, eq(schema.eventGoing.eventId, schema.events.id))
        .leftJoin(schema.profiles, eq(schema.events.organizerId, schema.profiles.id))
        .where(eq(schema.eventGoing.userId, session.user.id))
        .orderBy(desc(schema.events.startsAt));

      if (filter === 'upcoming') {
        events = events.filter((e) => new Date(e.endsAt) > now);
      } else if (filter === 'past') {
        events = events.filter((e) => new Date(e.endsAt) <= now);
      }

      const INTERACTION_WINDOW_HOURS = 7 * 24;

      const result = events.map((e) => {
        const isPast = new Date(e.endsAt) <= now;
        const canInteract = isPast && new Date(e.endsAt).getTime() + INTERACTION_WINDOW_HOURS * 60 * 60 * 1000 >= now.getTime();

        return {
          id: e.id,
          title: e.title,
          description: e.description,
          lineup: e.lineup,
          posterUrl: e.posterUrl,
          region: e.region,
          city: e.city,
          address: e.address,
          lat: parseFloat(e.lat),
          lng: parseFloat(e.lng),
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          genre: e.genre,
          ageLabel: e.ageLabel,
          priceType: e.priceType,
          price: e.price ? parseFloat(e.price) : null,
          ticketUrl: e.ticketUrl,
          status: e.status,
          organizer: {
            id: e.organizerId,
            username: e.organizerUsername,
            role: e.organizerRole,
          },
          isPast,
          canInteract,
        };
      });

      app.logger.info({ userId: session.user.id, count: result.length }, 'Going events fetched successfully');
      return result;
    }
  );

  // POST /api/organizers/:id/follow - Follow organizer
  fastify.post(
    '/api/organizers/:id/follow',
    {
      schema: {
        description: 'Follow organizer',
        tags: ['follows'],
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

      const { id } = request.params as { id: string };
      app.logger.info({ organizerId: id, userId: session.user.id }, 'Following organizer');

      const [organizer] = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, id));

      if (!organizer) {
        return reply.status(404).send({ error: 'Organizer not found' });
      }

      if (organizer.role !== 'organizer') {
        return reply.status(403).send({ error: 'Can only follow organizers' });
      }

      try {
        await app.db.insert(schema.organizerFollows).values({
          organizerId: id,
          userId: session.user.id,
        });
      } catch (error) {
        // Already following
        app.logger.warn({ organizerId: id, userId: session.user.id }, 'Already following');
      }

      app.logger.info({ organizerId: id, userId: session.user.id }, 'Organizer followed successfully');
      return { success: true };
    }
  );

  // DELETE /api/organizers/:id/follow - Unfollow organizer
  fastify.delete(
    '/api/organizers/:id/follow',
    {
      schema: {
        description: 'Unfollow organizer',
        tags: ['follows'],
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

      const { id } = request.params as { id: string };
      app.logger.info({ organizerId: id, userId: session.user.id }, 'Unfollowing organizer');

      await app.db
        .delete(schema.organizerFollows)
        .where(
          and(
            eq(schema.organizerFollows.organizerId, id),
            eq(schema.organizerFollows.userId, session.user.id)
          )
        );

      app.logger.info({ organizerId: id, userId: session.user.id }, 'Organizer unfollowed successfully');
      return { success: true };
    }
  );
}
