import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Log slow queries in development
prisma.$on('query' as never, (e: { duration: number; query: string }) => {
  if (e.duration > 500) {
    logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
  }
});

prisma.$on('error' as never, (e: { message: string }) => {
  logger.error(`Prisma error: ${e.message}`);
});

export async function connectDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    logger.info('ℹ️ DATABASE_URL environment variable is missing. Defaulting to PostgreSQL...');
    process.env.DATABASE_URL = 'postgresql://spare_admin:Spare@Admin123@localhost:5432/spare_inventory_db';
  }

  try {
    // Sync schema to PostgreSQL at server runtime
    const { execSync } = await import('child_process');
    try {
      logger.info('Syncing Prisma schema with database...');
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    } catch (pushErr) {
      logger.warn('Prisma db push notice:', pushErr);
    }

    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
