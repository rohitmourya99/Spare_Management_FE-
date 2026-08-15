import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var rawPrisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Ensures PostgreSQL connection string contains TCP keep-alive parameters
 * to prevent Neon or cloud load balancers from dropping idle sockets.
 */
function formatDatabaseUrl(urlStr: string): string {
  try {
    if (urlStr.startsWith('postgres://') || urlStr.startsWith('postgresql://')) {
      const url = new URL(urlStr);
      if (!url.searchParams.has('keepalives')) {
        url.searchParams.set('keepalives', '1');
      }
      if (!url.searchParams.has('keepalives_idle')) {
        url.searchParams.set('keepalives_idle', '30');
      }
      if (!url.searchParams.has('keepalives_interval')) {
        url.searchParams.set('keepalives_interval', '10');
      }
      if (!url.searchParams.has('keepalives_count')) {
        url.searchParams.set('keepalives_count', '5');
      }
      return url.toString();
    }
  } catch (_) {
    // If URL parsing fails, return as-is
  }
  return urlStr;
}

if (!process.env.DATABASE_URL) {
  logger.info('ℹ️ DATABASE_URL environment variable is missing. Defaulting to PostgreSQL...');
  process.env.DATABASE_URL = 'postgresql://spare_admin:Spare@Admin123@localhost:5432/spare_inventory_db';
}

// Enhance DATABASE_URL with TCP keep-alive settings
process.env.DATABASE_URL = formatDatabaseUrl(process.env.DATABASE_URL);

const basePrisma =
  global.rawPrisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (!global.rawPrisma) {
  global.rawPrisma = basePrisma;
}

// Log slow queries in development
basePrisma.$on('query' as never, (e: { duration: number; query: string }) => {
  if (e.duration > 500) {
    logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
  }
});

basePrisma.$on('error' as never, (e: { message: string }) => {
  logger.error(`Prisma error: ${e.message}`);
});

/**
 * Identifies whether an error is caused by a closed or dropped database connection.
 */
export function isConnectionError(error: any): boolean {
  if (!error) return false;
  const message = typeof error === 'string' ? error : String(error?.message || error);
  const code = error?.code;

  return (
    message.includes('Closed') ||
    message.includes('kind: Closed') ||
    message.includes('EngineClosed') ||
    message.includes('connection closed') ||
    message.includes('Client has been closed') ||
    message.includes('socket hang up') ||
    message.includes('ECONNRESET') ||
    message.includes('EPIPE') ||
    message.includes('ConnectionPoolTimeout') ||
    message.includes("Can't reach database server") ||
    code === 'P1001' ||
    code === 'P1017' ||
    code === 'P2024'
  );
}

/**
 * Wraps a database operation with automatic reconnection logic when an idle connection drop occurs.
 */
async function executeWithRetry<T>(fn: () => Promise<T>, client: PrismaClient): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (isConnectionError(error)) {
      logger.warn(`Database connection error detected (${error?.message || error}). Re-establishing connection...`);
      try {
        await client.$disconnect();
      } catch (_) {
        // Ignore disconnect errors on closed socket
      }
      try {
        await client.$connect();
        logger.info('✅ Prisma connection re-established successfully. Retrying query...');
        return await fn();
      } catch (reconnectErr) {
        logger.error('Failed to re-establish Prisma connection:', reconnectErr);
        throw error;
      }
    }
    throw error;
  }
}

/**
 * Creates a Proxy around PrismaClient to catch connection drops transparently.
 */
function createResilientPrismaClient(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target: any, prop: string | symbol, receiver: any) {
      const orig = Reflect.get(target, prop, receiver);

      // Handle raw queries and transaction methods
      if (
        prop === '$queryRaw' ||
        prop === '$executeRaw' ||
        prop === '$queryRawUnsafe' ||
        prop === '$executeRawUnsafe' ||
        prop === '$transaction'
      ) {
        return async (...args: any[]) => {
          return executeWithRetry(() => orig.apply(target, args), target);
        };
      }

      // Handle model delegates (e.g. prisma.user, prisma.inventoryItem)
      if (typeof orig === 'object' && orig !== null && !String(prop).startsWith('$')) {
        return new Proxy(orig, {
          get(modelTarget: any, modelProp: string | symbol) {
            const modelMethod = Reflect.get(modelTarget, modelProp);
            if (typeof modelMethod === 'function') {
              return async (...args: any[]) => {
                return executeWithRetry(() => modelMethod.apply(modelTarget, args), target);
              };
            }
            return modelMethod;
          },
        });
      }

      return orig;
    },
  });
}

export const prisma = global.prisma ?? createResilientPrismaClient(basePrisma);

if (!global.prisma) {
  global.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    // Sync schema to PostgreSQL at server runtime
    const { execSync } = await import('child_process');
    try {
      logger.info('Syncing Prisma schema with database...');
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    } catch (pushErr) {
      logger.warn('Prisma db push notice:', pushErr);
    }

    await basePrisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.warn('⚠️ Database connection warning (local dev mode active):', error);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await basePrisma.$disconnect();
  logger.info('Database disconnected');
}

