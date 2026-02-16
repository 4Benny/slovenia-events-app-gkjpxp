import { createApplication } from "@specific-dev/framework";
import * as schema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { register as registerEventsRoutes } from './routes/events.js';
import { register as registerInteractionsRoutes } from './routes/interactions.js';
import { register as registerProfilesRoutes } from './routes/profiles.js';
import { register as registerAdminRoutes } from './routes/admin.js';
import { register as registerAuthRoutes } from './routes/auth.js';
import { register as registerPublicRoutes } from './routes/public.js';

// Combine schemas
const combinedSchema = { ...schema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(combinedSchema);

// Enable authentication
app.withAuth();

// Export App type for use in route files
export type App = typeof app & {
  getSession: (request: any) => Promise<any>;
};

// Enable storage for image uploads
app.withStorage();

// Add getSession helper to app (wraps Better Auth get-session endpoint)
(app as any).getSession = async (request: any) => {
  try {
    const sessionToken = request.headers?.authorization?.split(' ')[1] || request.cookies?.session;
    if (!sessionToken) return null;

    const response = await (app as any).fastify.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
    });

    if (response.statusCode === 200) {
      return JSON.parse(response.payload);
    }
  } catch (err) {
    // Session not available
  }
  return null;
};

// Register auth hook for profile creation
registerAuthRoutes(app as any as App, app.fastify);

// Register route modules
registerPublicRoutes(app as any as App, app.fastify);
registerEventsRoutes(app as any as App, app.fastify);
registerInteractionsRoutes(app as any as App, app.fastify);
registerProfilesRoutes(app as any as App, app.fastify);
registerAdminRoutes(app as any as App, app.fastify);

await app.run();
app.logger.info('Application running');
