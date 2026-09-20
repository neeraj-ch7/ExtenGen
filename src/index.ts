import { buildApp } from './api/server.js';
import { env } from './config/env.js';
import { initQueue, closeQueue } from './services/queue.js';
import { closeDb } from './db/client.js';

async function start() {
  console.log('🚀 Starting ExtenGen Shared Memory Server...');

  // Initialize BullMQ Queue & Worker
  initQueue();

  const app = await buildApp();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      await closeQueue();
      await closeDb();
      console.log('👋 ExtenGen server stopped.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`✨ ExtenGen Server listening on ${address}`);
    console.log(`📡 Health Check:  http://localhost:${env.PORT}/health`);
    console.log(`🔌 MCP SSE URL:   http://localhost:${env.PORT}/sse`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
