// These shims exist so the editor/typecheck can function even when
// dependencies haven't been installed yet (e.g. missing GitHub Packages token).
// When real packages are installed, TypeScript will use their real types.

declare module "fastify" {
	export type FastifyHandler = (
		request: FastifyRequest,
		reply: FastifyReply
	) => unknown | Promise<unknown>;

	export type FastifyRouteOptions = Record<string, unknown>;

	export type FastifyRouteMethod = (
		path: string,
		options: FastifyRouteOptions,
		handler: FastifyHandler
	) => unknown;

	export interface FastifyInstance {
		get: FastifyRouteMethod;
		post: FastifyRouteMethod;
		put: FastifyRouteMethod;
		delete: FastifyRouteMethod;
	}

	export interface FastifyRequest {
		query?: unknown;
		params?: unknown;
		body?: unknown;
		headers?: Record<string, unknown>;
	}

	export interface FastifyReply {
		status: (statusCode: number) => FastifyReply;
		code: (statusCode: number) => FastifyReply;
		send: (payload?: unknown) => unknown;
	}
}

declare module "drizzle-orm" {
	export const eq: any;
	export const and: any;
	export const or: any;
	export const desc: any;
	export const count: any;
	export const avg: any;
	export const sql: any;
	export const isNull: any;
	export const gte: any;
	export const lte: any;
	export const ilike: any;
}
