import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { healthRoutes } from './routes/health.js';
import { observationRoutes } from './routes/observations.js';
import { recallRoutes } from './routes/recall.js';
import { githubRoutes } from './routes/github.js';
import { sseRoutes } from './sse.js';
import { env } from '../config/env.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test' ? { level: env.LOG_LEVEL } : false,
  });

  // Plugins
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  await app.register(sensible);

  // Register Routes
  await app.register(healthRoutes);
  await app.register(observationRoutes);
  await app.register(recallRoutes);
  await app.register(githubRoutes);
  await app.register(sseRoutes);

  return app;
}
