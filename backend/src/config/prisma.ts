import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Global singleton pattern for PrismaClient.
 * 
 * Prevents connection pool exhaustion in serverless or development hot-reload environments.
 * Supabase free/pro tiers enforce strict connection limits on PostgreSQL.
 * By maintaining a single instance and configuring transaction pooling via pgBouncer,
 * we ensure stable throughput without dropping connections.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prismaInstance: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

  if (env.NODE_ENV === 'development') {
    // Optional query performance logger for development
    (client as any).$on('query', (e: any) => {
      if (e.duration > 200) {
        console.warn(`[Prisma Slow Query - ${e.duration}ms] ${e.query}`);
      }
    });
  }

  return client;
}

export const prisma = global.__prismaInstance || createPrismaClient();

if (env.NODE_ENV !== 'production') {
  global.__prismaInstance = prisma;
}

// Graceful connection lifecycle cleanup
const cleanup = async () => {
  try {
    await prisma.$disconnect();
    console.log('[Prisma] Database connection closed cleanly.');
  } catch (err) {
    console.error('[Prisma] Error during disconnect:', err);
  }
};

process.on('beforeExit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

export default prisma;
