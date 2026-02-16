import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  numeric,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Profiles table - ID matches Better Auth user.id (TEXT type)
export const profiles = pgTable(
  'profiles',
  {
    id: text('id').primaryKey(), // References Better Auth user.id
    username: text('username').notNull().unique(),
    role: text('role', { enum: ['user', 'organizer', 'admin'] })
      .notNull()
      .default('user'),
    avatarUrl: text('avatar_url'),
    region: text('region'),
    city: text('city'),
    showLocation: boolean('show_location').default(true),
    instagramUsername: text('instagram_username'),
    snapchatUsername: text('snapchat_username'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('profiles_username_idx').on(table.username),
    index('profiles_role_idx').on(table.role),
  ]
);

// Events table
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    lineup: text('lineup'),
    posterUrl: text('poster_url'),
    region: text('region').notNull(),
    city: text('city').notNull(),
    address: text('address').notNull(),
    lat: numeric('lat', { precision: 10, scale: 6 }).notNull(),
    lng: numeric('lng', { precision: 10, scale: 6 }).notNull(),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    genre: text('genre', {
      enum: [
        'electronic',
        'rock',
        'pop',
        'hip-hop',
        'techno',
        'house',
        'trance',
        'dnb',
        'dubstep',
        'other',
      ],
    }).notNull(),
    ageLabel: text('age_label').notNull().default('18+'),
    priceType: text('price_type', { enum: ['free', 'paid'] }).notNull(),
    price: numeric('price', { precision: 10, scale: 2 }),
    ticketUrl: text('ticket_url'),
    status: text('status', {
      enum: ['draft', 'published', 'cancelled'],
    })
      .notNull()
      .default('draft'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('events_organizer_id_idx').on(table.organizerId),
    index('events_status_idx').on(table.status),
    index('events_region_city_idx').on(table.region, table.city),
    index('events_starts_at_idx').on(table.startsAt),
    check('ends_at_after_starts_at', sql`${table.endsAt} > ${table.startsAt}`),
  ]
);

// Event going table
export const eventGoing = pgTable(
  'event_going',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('event_going_event_user_unique').on(
      table.eventId,
      table.userId
    ),
    index('event_going_event_id_idx').on(table.eventId),
    index('event_going_user_id_idx').on(table.userId),
  ]
);

// Organizer follows table
export const organizerFollows = pgTable(
  'organizer_follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('organizer_follows_organizer_user_unique').on(
      table.organizerId,
      table.userId
    ),
    index('organizer_follows_organizer_id_idx').on(table.organizerId),
    index('organizer_follows_user_id_idx').on(table.userId),
  ]
);

// Event comments table
export const eventComments = pgTable(
  'event_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('event_comments_event_id_idx').on(table.eventId),
    index('event_comments_user_id_idx').on(table.userId),
  ]
);

// Event images table
export const eventImages = pgTable(
  'event_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('event_images_event_id_idx').on(table.eventId),
    index('event_images_user_id_idx').on(table.userId),
  ]
);

// Event ratings table
export const eventRatings = pgTable(
  'event_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    rating: numeric('rating', { precision: 2, scale: 1 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('event_ratings_event_user_unique').on(
      table.eventId,
      table.userId
    ),
    index('event_ratings_event_id_idx').on(table.eventId),
    index('event_ratings_user_id_idx').on(table.userId),
    check('rating_range', sql`${table.rating} >= 1.0 AND ${table.rating} <= 5.0`),
  ]
);

// Reports table
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    targetType: text('target_type', {
      enum: ['event', 'comment', 'image', 'user'],
    }).notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    status: text('status', {
      enum: ['pending', 'reviewed', 'resolved'],
    })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('reports_reporter_id_idx').on(table.reporterId),
    index('reports_target_type_id_idx').on(table.targetType, table.targetId),
    index('reports_status_idx').on(table.status),
  ]
);
