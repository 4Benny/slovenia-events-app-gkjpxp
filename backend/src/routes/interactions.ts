import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, count } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

const INTERACTION_WINDOW_HOURS = 7 * 24; // 7 days
const MAX_IMAGES_PER_USER = 5;
const MAX_COMMENT_LENGTH = 300;

function sanitizeComment(body: string): string {
  return body.replace(/https?:\/\/[^\s]+/g, '').trim();
}

function isInInteractionWindow(eventEndsAt: Date): boolean {
  const now = new Date();
  const endTime = new Date(eventEndsAt);
  const windowEndTime = new Date(endTime.getTime() + INTERACTION_WINDOW_HOURS * 60 * 60 * 1000);
  return now >= endTime && now <= windowEndTime;
}

function validateRating(rating: number): boolean {
  return rating >= 1.0 && rating <= 5.0 && Math.round(rating * 10) / 10 === rating;
}

export function register(app: App, fastify: FastifyInstance) {
  // POST /api/events/:id/going - Mark going
  fastify.post(
    '/api/events/:id/going',
    {
      schema: {
        description: 'Mark as going',
        tags: ['interactions'],
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
      app.logger.info({ eventId: id, userId: session.user.id }, 'Marking as going');

      const [event] = await app.db.select().from(schema.events).where(eq(schema.events.id, id));

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      // Cannot mark going on own event
      if (event.organizerId === session.user.id) {
        return reply.status(403).send({ error: 'Cannot mark going on own event' });
      }

      try {
        await app.db.insert(schema.eventGoing).values({
          eventId: id,
          userId: session.user.id,
        });
      } catch (error) {
        // Already marked going
        app.logger.warn({ eventId: id, userId: session.user.id }, 'Already marked as going');
      }

      app.logger.info({ eventId: id, userId: session.user.id }, 'Marked as going successfully');
      return { success: true };
    }
  );

  // DELETE /api/events/:id/going - Remove going
  fastify.delete(
    '/api/events/:id/going',
    {
      schema: {
        description: 'Remove going status',
        tags: ['interactions'],
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
      app.logger.info({ eventId: id, userId: session.user.id }, 'Removing going status');

      await app.db
        .delete(schema.eventGoing)
        .where(
          and(
            eq(schema.eventGoing.eventId, id),
            eq(schema.eventGoing.userId, session.user.id)
          )
        );

      app.logger.info({ eventId: id, userId: session.user.id }, 'Going status removed successfully');
      return { success: true };
    }
  );

  // GET /api/events/:id/attendees - Get attendee list
  fastify.get(
    '/api/events/:id/attendees',
    {
      schema: {
        description: 'Get attendee list',
        tags: ['interactions'],
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
      app.logger.info({ eventId: id, userId: session.user.id }, 'Fetching attendees');

      // User must be going to see attendees
      const [isGoing] = await app.db
        .select()
        .from(schema.eventGoing)
        .where(
          and(
            eq(schema.eventGoing.eventId, id),
            eq(schema.eventGoing.userId, session.user.id)
          )
        );

      if (!isGoing) {
        return reply.status(403).send({ error: 'Must be going to see attendees' });
      }

      const attendees = await app.db
        .select({
          id: schema.profiles.id,
          username: schema.profiles.username,
          avatarUrl: schema.profiles.avatarUrl,
        })
        .from(schema.eventGoing)
        .leftJoin(schema.profiles, eq(schema.eventGoing.userId, schema.profiles.id))
        .where(eq(schema.eventGoing.eventId, id));

      app.logger.info({ eventId: id, count: attendees.length }, 'Attendees fetched successfully');
      return attendees;
    }
  );

  // POST /api/events/:id/comments - Add comment
  fastify.post(
    '/api/events/:id/comments',
    {
      schema: {
        description: 'Add comment',
        tags: ['interactions'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: { body: { type: 'string' } },
          required: ['body'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.getSession(request);
      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const { body } = request.body as { body: string };

      app.logger.info({ eventId: id, userId: session.user.id, bodyLength: body.length }, 'Adding comment');

      const [event] = await app.db.select().from(schema.events).where(eq(schema.events.id, id));

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      // Check if user is going
      const [isGoing] = await app.db
        .select()
        .from(schema.eventGoing)
        .where(
          and(
            eq(schema.eventGoing.eventId, id),
            eq(schema.eventGoing.userId, session.user.id)
          )
        );

      if (!isGoing) {
        return reply.status(403).send({ error: 'Must be going to comment' });
      }

      // Check interaction window
      if (!isInInteractionWindow(event.endsAt)) {
        return reply.status(403).send({ error: 'Can only comment within 7 days after event ends' });
      }

      const sanitized = sanitizeComment(body);

      if (sanitized.length === 0) {
        return reply.status(400).send({ error: 'Comment cannot be empty' });
      }

      if (sanitized.length > MAX_COMMENT_LENGTH) {
        return reply.status(400).send({ error: `Comment must be max ${MAX_COMMENT_LENGTH} characters` });
      }

      const [comment] = await app.db
        .insert(schema.eventComments)
        .values({
          eventId: id,
          userId: session.user.id,
          body: sanitized,
        })
        .returning();

      const [userProfile] = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, session.user.id));

      app.logger.info({ commentId: comment.id, eventId: id }, 'Comment added successfully');

      return {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        user: {
          id: userProfile?.id,
          username: userProfile?.username,
          avatarUrl: userProfile?.avatarUrl,
        },
      };
    }
  );

  // DELETE /api/comments/:id - Delete comment
  fastify.delete(
    '/api/comments/:id',
    {
      schema: {
        description: 'Delete comment',
        tags: ['interactions'],
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
      app.logger.info({ commentId: id, userId: session.user.id }, 'Deleting comment');

      const [comment] = await app.db
        .select()
        .from(schema.eventComments)
        .where(eq(schema.eventComments.id, id));

      if (!comment) {
        return reply.status(404).send({ error: 'Comment not found' });
      }

      if (comment.userId !== session.user.id) {
        const [userProfile] = await app.db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.id, session.user.id));

        if (userProfile?.role !== 'admin') {
          return reply.status(403).send({ error: 'Unauthorized' });
        }
      }

      await app.db.delete(schema.eventComments).where(eq(schema.eventComments.id, id));

      app.logger.info({ commentId: id }, 'Comment deleted successfully');
      return { success: true };
    }
  );

  // DELETE /api/comments/:id/admin - Hard delete comment (admin only)
  fastify.delete(
    '/api/comments/:id/admin',
    {
      schema: {
        description: 'Hard delete comment (admin)',
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
      app.logger.info({ commentId: id, userId: session.user.id }, 'Admin hard delete comment');

      const [comment] = await app.db
        .select()
        .from(schema.eventComments)
        .where(eq(schema.eventComments.id, id));

      if (!comment) {
        return reply.status(404).send({ error: 'Comment not found' });
      }

      await app.db.delete(schema.eventComments).where(eq(schema.eventComments.id, id));

      app.logger.info({ commentId: id }, 'Comment hard deleted successfully');
      return { success: true };
    }
  );

  // POST /api/events/:id/images - Upload image
  fastify.post(
    '/api/events/:id/images',
    {
      schema: {
        description: 'Upload image',
        tags: ['interactions'],
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
      app.logger.info({ eventId: id, userId: session.user.id }, 'Uploading image');

      const [event] = await app.db.select().from(schema.events).where(eq(schema.events.id, id));

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      // Check if user is going
      const [isGoing] = await app.db
        .select()
        .from(schema.eventGoing)
        .where(
          and(
            eq(schema.eventGoing.eventId, id),
            eq(schema.eventGoing.userId, session.user.id)
          )
        );

      if (!isGoing) {
        return reply.status(403).send({ error: 'Must be going to upload images' });
      }

      // Check interaction window
      if (!isInInteractionWindow(event.endsAt)) {
        return reply.status(403).send({ error: 'Can only upload images within 7 days after event ends' });
      }

      // Check max images per user per event
      const [{ value: userImageCount }] = await app.db
        .select({ value: count() })
        .from(schema.eventImages)
        .where(
          and(
            eq(schema.eventImages.eventId, id),
            eq(schema.eventImages.userId, session.user.id)
          )
        );

      if (userImageCount >= MAX_IMAGES_PER_USER) {
        return reply.status(403).send({ error: `Max ${MAX_IMAGES_PER_USER} images per user per event` });
      }

      const data = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });

      if (!data) {
        return reply.status(400).send({ error: 'No file provided' });
      }

      let buffer: Buffer;
      try {
        buffer = await data.toBuffer();
      } catch (err) {
        return reply.status(413).send({ error: 'File too large (max 5MB)' });
      }

      const key = `events/${id}/${session.user.id}/${Date.now()}-${data.filename}`;

      try {
        const uploadedKey = await app.storage.upload(key, buffer);
        const { url } = await app.storage.getSignedUrl(uploadedKey);

        const [image] = await app.db
          .insert(schema.eventImages)
          .values({
            eventId: id,
            userId: session.user.id,
            imageUrl: url,
          })
          .returning();

        app.logger.info({ imageId: image.id, eventId: id }, 'Image uploaded successfully');

        return {
          id: image.id,
          imageUrl: image.imageUrl,
          createdAt: image.createdAt,
        };
      } catch (error) {
        app.logger.error({ err: error, eventId: id }, 'Failed to upload image');
        return reply.status(500).send({ error: 'Failed to upload image' });
      }
    }
  );

  // DELETE /api/images/:id - Delete image
  fastify.delete(
    '/api/images/:id',
    {
      schema: {
        description: 'Delete image',
        tags: ['interactions'],
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
      app.logger.info({ imageId: id, userId: session.user.id }, 'Deleting image');

      const [image] = await app.db
        .select()
        .from(schema.eventImages)
        .where(eq(schema.eventImages.id, id));

      if (!image) {
        return reply.status(404).send({ error: 'Image not found' });
      }

      if (image.userId !== session.user.id) {
        const [userProfile] = await app.db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.id, session.user.id));

        if (userProfile?.role !== 'admin') {
          return reply.status(403).send({ error: 'Unauthorized' });
        }
      }

      await app.db.delete(schema.eventImages).where(eq(schema.eventImages.id, id));

      app.logger.info({ imageId: id }, 'Image deleted successfully');
      return { success: true };
    }
  );

  // DELETE /api/images/:id/admin - Hard delete image (admin only)
  fastify.delete(
    '/api/images/:id/admin',
    {
      schema: {
        description: 'Hard delete image (admin)',
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
      app.logger.info({ imageId: id, userId: session.user.id }, 'Admin hard delete image');

      const [image] = await app.db
        .select()
        .from(schema.eventImages)
        .where(eq(schema.eventImages.id, id));

      if (!image) {
        return reply.status(404).send({ error: 'Image not found' });
      }

      await app.db.delete(schema.eventImages).where(eq(schema.eventImages.id, id));

      app.logger.info({ imageId: id }, 'Image hard deleted successfully');
      return { success: true };
    }
  );

  // POST /api/events/:id/ratings - Rate event
  fastify.post(
    '/api/events/:id/ratings',
    {
      schema: {
        description: 'Rate event',
        tags: ['interactions'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: { rating: { type: 'number' } },
          required: ['rating'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.getSession(request);
      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const { rating } = request.body as { rating: number };

      app.logger.info({ eventId: id, userId: session.user.id, rating }, 'Rating event');

      if (!validateRating(rating)) {
        return reply.status(400).send({ error: 'Rating must be between 1.0 and 5.0 with 1 decimal' });
      }

      const [event] = await app.db.select().from(schema.events).where(eq(schema.events.id, id));

      if (!event) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      // Check if user is going
      const [isGoing] = await app.db
        .select()
        .from(schema.eventGoing)
        .where(
          and(
            eq(schema.eventGoing.eventId, id),
            eq(schema.eventGoing.userId, session.user.id)
          )
        );

      if (!isGoing) {
        return reply.status(403).send({ error: 'Must be going to rate' });
      }

      // Check interaction window
      if (!isInInteractionWindow(event.endsAt)) {
        return reply.status(403).send({ error: 'Can only rate within 7 days after event ends' });
      }

      try {
        const [eventRating] = await app.db
          .insert(schema.eventRatings)
          .values({
            eventId: id,
            userId: session.user.id,
            rating: rating.toString(),
          })
          .returning();

        app.logger.info({ ratingId: eventRating.id, eventId: id }, 'Event rated successfully');

        return {
          id: eventRating.id,
          rating: parseFloat(eventRating.rating),
          createdAt: eventRating.createdAt,
        };
      } catch (error) {
        // User already rated this event
        app.logger.warn({ eventId: id, userId: session.user.id }, 'User already rated this event');
        return reply.status(409).send({ error: 'Already rated this event' });
      }
    }
  );

  // PUT /api/ratings/:id - Update rating
  fastify.put(
    '/api/ratings/:id',
    {
      schema: {
        description: 'Update rating',
        tags: ['interactions'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: { rating: { type: 'number' } },
          required: ['rating'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.getSession(request);
      if (!session) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const { rating } = request.body as { rating: number };

      app.logger.info({ ratingId: id, userId: session.user.id, rating }, 'Updating rating');

      if (!validateRating(rating)) {
        return reply.status(400).send({ error: 'Rating must be between 1.0 and 5.0 with 1 decimal' });
      }

      const [eventRating] = await app.db
        .select()
        .from(schema.eventRatings)
        .where(eq(schema.eventRatings.id, id));

      if (!eventRating) {
        return reply.status(404).send({ error: 'Rating not found' });
      }

      if (eventRating.userId !== session.user.id) {
        const [userProfile] = await app.db
          .select()
          .from(schema.profiles)
          .where(eq(schema.profiles.id, session.user.id));

        if (userProfile?.role !== 'admin') {
          return reply.status(403).send({ error: 'Unauthorized' });
        }
      }

      const [updated] = await app.db
        .update(schema.eventRatings)
        .set({ rating: rating.toString() })
        .where(eq(schema.eventRatings.id, id))
        .returning();

      app.logger.info({ ratingId: id }, 'Rating updated successfully');

      return {
        id: updated.id,
        rating: parseFloat(updated.rating),
        createdAt: updated.createdAt,
      };
    }
  );

  // DELETE /api/ratings/:id/admin - Hard delete rating (admin only)
  fastify.delete(
    '/api/ratings/:id/admin',
    {
      schema: {
        description: 'Hard delete rating (admin)',
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
      app.logger.info({ ratingId: id, userId: session.user.id }, 'Admin hard delete rating');

      const [rating] = await app.db
        .select()
        .from(schema.eventRatings)
        .where(eq(schema.eventRatings.id, id));

      if (!rating) {
        return reply.status(404).send({ error: 'Rating not found' });
      }

      await app.db.delete(schema.eventRatings).where(eq(schema.eventRatings.id, id));

      app.logger.info({ ratingId: id }, 'Rating hard deleted successfully');
      return { success: true };
    }
  );
}
