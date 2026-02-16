import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or, desc, count, avg, sql, isNull, gte, lte, ilike } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

const INTERACTION_WINDOW_HOURS = 7 * 24; // 7 days
const MAX_IMAGES_PER_USER = 5;

// Utilities
function sanitizeComment(body: string): string {
  // Remove URLs from comment
  return body.replace(/https?:\/\/[^\s]+/g, '').trim();
}

function validateUsername(username: string): boolean {
  return /^[a-z0-9_-]{3,}$/.test(username);
}

function validateRating(rating: number): boolean {
  return rating >= 1.0 && rating <= 5.0 && Math.round(rating * 10) / 10 === rating;
}

function isInInteractionWindow(eventEndsAt: Date): boolean {
  const now = new Date();
  const endTime = new Date(eventEndsAt);
  const windowEndTime = new Date(endTime.getTime() + INTERACTION_WINDOW_HOURS * 60 * 60 * 1000);
  return now >= endTime && now <= windowEndTime;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/events - Get all published events sorted by distance
  fastify.get(
    '/api/events',
    {
      schema: {
        description: 'Get upcoming published events sorted by distance',
        tags: ['events'],
        querystring: {
          type: 'object',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' },
            region: { type: 'string' },
            city: { type: 'string' },
            genre: { type: 'string' },
            search: { type: 'string' },
          },
          required: ['lat', 'lng'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { lat, lng, region, city, genre, search } = request.query as {
        lat?: string;
        lng?: string;
        region?: string;
        city?: string;
        genre?: string;
        search?: string;
      };

      app.logger.info({ lat, lng, region, city, genre, search }, 'Fetching events');

      if (!lat || !lng) {
        return reply.status(400).send({ error: 'lat and lng are required' });
      }

      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      if (isNaN(userLat) || isNaN(userLng)) {
        return reply.status(400).send({ error: 'Invalid lat or lng' });
      }

      // Build where conditions
      const whereConditions = [eq(schema.events.status, 'published')];
      if (genre) whereConditions.push(eq(schema.events.genre, genre as any));
      if (region) whereConditions.push(eq(schema.events.region, region));
      if (city) whereConditions.push(eq(schema.events.city, city));
      if (search) {
        whereConditions.push(
          or(
            ilike(schema.events.title, `%${search}%`),
            ilike(schema.events.description, `%${search}%`)
          )
        );
      }

      const events = await app.db
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
          goingCount: sql<number>`COALESCE(${count(schema.eventGoing.id)}, 0)`.as('going_count'),
          avgRating: avg(schema.eventRatings.rating).as('avg_rating'),
        })
        .from(schema.events)
        .leftJoin(schema.profiles, eq(schema.events.organizerId, schema.profiles.id))
        .leftJoin(schema.eventGoing, eq(schema.events.id, schema.eventGoing.eventId))
        .leftJoin(schema.eventRatings, eq(schema.events.id, schema.eventRatings.eventId))
        .where(and(...whereConditions))
        .groupBy(
          schema.events.id,
          schema.profiles.id,
          schema.profiles.username,
          schema.profiles.role
        )
        .orderBy(desc(schema.events.startsAt));

      const enrichedEvents = events.map((event) => {
        const eventLat = parseFloat(event.lat);
        const eventLng = parseFloat(event.lng);
        const distance = calculateDistance(userLat, userLng, eventLat, eventLng);
        const isToday = new Date(event.startsAt).toDateString() === new Date().toDateString();
        const isCancelled = event.status === 'cancelled';

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          lineup: event.lineup,
          posterUrl: event.posterUrl,
          region: event.region,
          city: event.city,
          address: event.address,
          lat: eventLat,
          lng: eventLng,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          genre: event.genre,
          ageLabel: event.ageLabel,
          priceType: event.priceType,
          price: event.price ? parseFloat(event.price) : null,
          ticketUrl: event.ticketUrl,
          status: event.status,
          distance,
          organizer: {
            id: event.organizerId,
            username: event.organizerUsername,
            role: event.organizerRole,
          },
          goingCount: event.goingCount,
          avgRating: event.avgRating ? parseFloat(event.avgRating) : null,
          isToday,
          isCancelled,
        };
      });

      enrichedEvents.sort((a, b) => a.distance - b.distance);

      app.logger.info({ count: enrichedEvents.length }, 'Events fetched successfully');
      return enrichedEvents;
    }
  );

  // GET /api/events/:id - Get event detail
  fastify.get(
    '/api/events/:id',
    {
      schema: {
        description: 'Get event detail',
        tags: ['events'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      app.logger.info({ eventId: id }, 'Fetching event detail');

      const [event] = await app.db
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
          organizerAvatarUrl: schema.profiles.avatarUrl,
          goingCount: count(schema.eventGoing.id).as('going_count'),
          avgRating: avg(schema.eventRatings.rating).as('avg_rating'),
          commentsCount: count(schema.eventComments.id).as('comments_count'),
          imagesCount: count(schema.eventImages.id).as('images_count'),
        })
        .from(schema.events)
        .leftJoin(schema.profiles, eq(schema.events.organizerId, schema.profiles.id))
        .leftJoin(schema.eventGoing, eq(schema.events.id, schema.eventGoing.eventId))
        .leftJoin(schema.eventRatings, eq(schema.events.id, schema.eventRatings.eventId))
        .leftJoin(schema.eventComments, eq(schema.events.id, schema.eventComments.eventId))
        .leftJoin(schema.eventImages, eq(schema.events.id, schema.eventImages.eventId))
        .where(eq(schema.events.id, id))
        .groupBy(schema.events.id, schema.profiles.id);

      if (!event) {
        app.logger.warn({ eventId: id }, 'Event not found');
        return reply.status(404).send({ error: 'Event not found' });
      }

      // Check if user is authenticated
      const session = await app.getSession(request);
      let isGoing = false;
      let isFollowingOrganizer = false;
      let userRating = null;

      if (session) {
        const [goingRecord] = await app.db
          .select()
          .from(schema.eventGoing)
          .where(
            and(
              eq(schema.eventGoing.eventId, id),
              eq(schema.eventGoing.userId, session.user.id)
            )
          );
        isGoing = !!goingRecord;

        const [followRecord] = await app.db
          .select()
          .from(schema.organizerFollows)
          .where(
            and(
              eq(schema.organizerFollows.organizerId, event.organizerId),
              eq(schema.organizerFollows.userId, session.user.id)
            )
          );
        isFollowingOrganizer = !!followRecord;

        const [ratingRecord] = await app.db
          .select()
          .from(schema.eventRatings)
          .where(
            and(
              eq(schema.eventRatings.eventId, id),
              eq(schema.eventRatings.userId, session.user.id)
            )
          );
        userRating = ratingRecord ? parseFloat(ratingRecord.rating) : null;
      }

      const eventDetail = {
        id: event.id,
        title: event.title,
        description: event.description,
        lineup: event.lineup,
        posterUrl: event.posterUrl,
        region: event.region,
        city: event.city,
        address: event.address,
        lat: parseFloat(event.lat),
        lng: parseFloat(event.lng),
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        genre: event.genre,
        ageLabel: event.ageLabel,
        priceType: event.priceType,
        price: event.price ? parseFloat(event.price) : null,
        ticketUrl: event.ticketUrl,
        status: event.status,
        organizer: {
          id: event.organizerId,
          username: event.organizerUsername,
          role: event.organizerRole,
          avatarUrl: event.organizerAvatarUrl,
        },
        goingCount: event.goingCount,
        avgRating: event.avgRating ? parseFloat(event.avgRating) : null,
        commentsCount: event.commentsCount,
        imagesCount: event.imagesCount,
        ...(session && {
          isGoing,
          isFollowingOrganizer,
          userRating,
        }),
      };

      app.logger.info({ eventId: id }, 'Event detail fetched successfully');
      return eventDetail;
    }
  );

  // GET /api/events/:id/comments - Get comments
  fastify.get(
    '/api/events/:id/comments',
    {
      schema: {
        description: 'Get event comments',
        tags: ['events'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      app.logger.info({ eventId: id }, 'Fetching event comments');

      const comments = await app.db
        .select({
          id: schema.eventComments.id,
          body: schema.eventComments.body,
          createdAt: schema.eventComments.createdAt,
          userId: schema.eventComments.userId,
          username: schema.profiles.username,
          avatarUrl: schema.profiles.avatarUrl,
        })
        .from(schema.eventComments)
        .leftJoin(schema.profiles, eq(schema.eventComments.userId, schema.profiles.id))
        .where(eq(schema.eventComments.eventId, id))
        .orderBy(desc(schema.eventComments.createdAt));

      const result = comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        user: {
          id: c.userId,
          username: c.username,
          avatarUrl: c.avatarUrl,
        },
      }));

      app.logger.info({ eventId: id, count: result.length }, 'Comments fetched successfully');
      return result;
    }
  );

  // GET /api/events/:id/images - Get images
  fastify.get(
    '/api/events/:id/images',
    {
      schema: {
        description: 'Get event images',
        tags: ['events'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      app.logger.info({ eventId: id }, 'Fetching event images');

      const images = await app.db
        .select({
          id: schema.eventImages.id,
          imageUrl: schema.eventImages.imageUrl,
          createdAt: schema.eventImages.createdAt,
          userId: schema.eventImages.userId,
          username: schema.profiles.username,
          avatarUrl: schema.profiles.avatarUrl,
        })
        .from(schema.eventImages)
        .leftJoin(schema.profiles, eq(schema.eventImages.userId, schema.profiles.id))
        .where(eq(schema.eventImages.eventId, id))
        .orderBy(desc(schema.eventImages.createdAt));

      const result = images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        createdAt: img.createdAt,
        user: {
          id: img.userId,
          username: img.username,
          avatarUrl: img.avatarUrl,
        },
      }));

      app.logger.info({ eventId: id, count: result.length }, 'Images fetched successfully');
      return result;
    }
  );

  // POST /api/events - Create event (organizer only)
  fastify.post(
    '/api/events',
    {
      schema: {
        description: 'Create event',
        tags: ['events'],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            lineup: { type: 'string' },
            posterUrl: { type: 'string' },
            region: { type: 'string' },
            city: { type: 'string' },
            address: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            startsAt: { type: 'string' },
            endsAt: { type: 'string' },
            genre: { type: 'string' },
            ageLabel: { type: 'string' },
            priceType: { type: 'string' },
            price: { type: 'number' },
            ticketUrl: { type: 'string' },
            status: { type: 'string' },
          },
          required: [
            'title',
            'region',
            'city',
            'address',
            'lat',
            'lng',
            'startsAt',
            'endsAt',
            'genre',
            'priceType',
          ],
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

      if (userProfile?.role !== 'organizer' && userProfile?.role !== 'admin') {
        return reply.status(403).send({ error: 'Must be organizer or admin' });
      }

      const body = request.body as any;
      app.logger.info({ body, userId: session.user.id }, 'Creating event');

      const startsAt = new Date(body.startsAt);
      const endsAt = new Date(body.endsAt);

      if (endsAt <= startsAt) {
        return reply.status(400).send({ error: 'endsAt must be after startsAt' });
      }

      const [event] = await app.db
        .insert(schema.events)
        .values({
          organizerId: session.user.id,
          title: body.title,
          description: body.description || null,
          lineup: body.lineup || null,
          posterUrl: body.posterUrl || null,
          region: body.region,
          city: body.city,
          address: body.address,
          lat: body.lat.toString(),
          lng: body.lng.toString(),
          startsAt,
          endsAt,
          genre: body.genre,
          ageLabel: body.ageLabel || '18+',
          priceType: body.priceType,
          price: body.price ? body.price.toString() : null,
          ticketUrl: body.ticketUrl || null,
          status: body.status || 'draft',
        })
        .returning();

      app.logger.info({ eventId: event.id }, 'Event created successfully');

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        lineup: event.lineup,
        posterUrl: event.posterUrl,
        region: event.region,
        city: event.city,
        address: event.address,
        lat: parseFloat(event.lat),
        lng: parseFloat(event.lng),
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        genre: event.genre,
        ageLabel: event.ageLabel,
        priceType: event.priceType,
        price: event.price ? parseFloat(event.price) : null,
        ticketUrl: event.ticketUrl,
        status: event.status,
        organizerId: event.organizerId,
        createdAt: event.createdAt,
      };
    }
  );

  // PUT /api/events/:id - Update event (organizer only)
  fastify.put(
    '/api/events/:id',
    {
      schema: {
        description: 'Update event',
        tags: ['events'],
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
      const body = request.body as any;

      app.logger.info({ eventId: id, body, userId: session.user.id }, 'Updating event');

      const [event] = await app.db.select().from(schema.events).where(eq(schema.events.id, id));

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      if (event.organizerId !== session.user.id) {
        const [userProfile] = await app.db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.id, session.user.id));

        if (userProfile?.role !== 'admin') {
          return reply.status(403).send({ error: 'Unauthorized' });
        }
      }

      const startsAt = body.startsAt ? new Date(body.startsAt) : event.startsAt;
      const endsAt = body.endsAt ? new Date(body.endsAt) : event.endsAt;

      if (endsAt <= startsAt) {
        return reply.status(400).send({ error: 'endsAt must be after startsAt' });
      }

      const [updated] = await app.db
        .update(schema.events)
        .set({
          title: body.title || event.title,
          description: body.description !== undefined ? body.description : event.description,
          lineup: body.lineup !== undefined ? body.lineup : event.lineup,
          posterUrl: body.posterUrl !== undefined ? body.posterUrl : event.posterUrl,
          region: body.region || event.region,
          city: body.city || event.city,
          address: body.address || event.address,
          lat: body.lat !== undefined ? body.lat.toString() : event.lat,
          lng: body.lng !== undefined ? body.lng.toString() : event.lng,
          startsAt,
          endsAt,
          genre: body.genre || event.genre,
          ageLabel: body.ageLabel || event.ageLabel,
          priceType: body.priceType || event.priceType,
          price: body.price !== undefined ? (body.price ? body.price.toString() : null) : event.price,
          ticketUrl: body.ticketUrl !== undefined ? body.ticketUrl : event.ticketUrl,
          status: body.status || event.status,
        })
        .where(eq(schema.events.id, id))
        .returning();

      app.logger.info({ eventId: id }, 'Event updated successfully');

      return {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        lineup: updated.lineup,
        posterUrl: updated.posterUrl,
        region: updated.region,
        city: updated.city,
        address: updated.address,
        lat: parseFloat(updated.lat),
        lng: parseFloat(updated.lng),
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
        genre: updated.genre,
        ageLabel: updated.ageLabel,
        priceType: updated.priceType,
        price: updated.price ? parseFloat(updated.price) : null,
        ticketUrl: updated.ticketUrl,
        status: updated.status,
        organizerId: updated.organizerId,
        createdAt: updated.createdAt,
      };
    }
  );

  // DELETE /api/events/:id - Delete event
  fastify.delete(
    '/api/events/:id',
    {
      schema: {
        description: 'Delete event',
        tags: ['events'],
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
      app.logger.info({ eventId: id, userId: session.user.id }, 'Deleting event');

      const [userProfile] = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, session.user.id));

      const isAdmin = userProfile?.role === 'admin';

      const [event] = await app.db.select().from(schema.events).where(eq(schema.events.id, id));

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      if (!isAdmin && event.organizerId !== session.user.id) {
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Organizers cannot delete events that already ended.
      if (!isAdmin) {
        const endsAt = new Date((event as any).endsAt);
        if (Number.isFinite(endsAt.getTime()) && endsAt.getTime() < Date.now()) {
          return reply.status(403).send({ error: 'Cannot delete ended events' });
        }
      }

      await app.db.delete(schema.events).where(eq(schema.events.id, id));

      app.logger.info({ eventId: id }, 'Event deleted successfully');
      return { success: true };
    }
  );

  // GET /api/organizer/events - Get organizer's events
  fastify.get(
    '/api/organizer/events',
    {
      schema: {
        description: 'Get organizer events',
        tags: ['organizer'],
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

      if (userProfile?.role !== 'organizer' && userProfile?.role !== 'admin') {
        return reply.status(403).send({ error: 'Must be organizer or admin' });
      }

      app.logger.info({ userId: session.user.id }, 'Fetching organizer events');

      const isAdmin = userProfile?.role === 'admin';
      const organizerId = isAdmin ? null : session.user.id;

      let query = app.db
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
          createdAt: schema.events.createdAt,
          organizerId: schema.events.organizerId,
          goingCount: count(schema.eventGoing.id).as('going_count'),
          commentsCount: count(schema.eventComments.id).as('comments_count'),
          imagesCount: count(schema.eventImages.id).as('images_count'),
          ratingsCount: count(schema.eventRatings.id).as('ratings_count'),
          avgRating: avg(schema.eventRatings.rating).as('avg_rating'),
        })
        .from(schema.events)
        .leftJoin(schema.eventGoing, eq(schema.events.id, schema.eventGoing.eventId))
        .leftJoin(schema.eventComments, eq(schema.events.id, schema.eventComments.eventId))
        .leftJoin(schema.eventImages, eq(schema.events.id, schema.eventImages.eventId))
        .leftJoin(schema.eventRatings, eq(schema.events.id, schema.eventRatings.eventId));

      if (organizerId) {
        query = query.where(eq(schema.events.organizerId, organizerId));
      }

      const events = await query
        .groupBy(schema.events.id)
        .orderBy(desc(schema.events.createdAt));

      const result = events.map((e) => ({
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
        createdAt: e.createdAt,
        organizerId: e.organizerId,
        goingCount: e.goingCount,
        commentsCount: e.commentsCount,
        imagesCount: e.imagesCount,
        ratingsCount: e.ratingsCount,
        avgRating: e.avgRating ? parseFloat(e.avgRating) : null,
      }));

      app.logger.info({ count: result.length }, 'Organizer events fetched successfully');
      return result;
    }
  );
}
