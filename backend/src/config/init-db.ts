import { prisma } from './database';
import bcrypt from 'bcryptjs';
import { logger } from './logger';

/**
 * Ensures database tables exist and default users are seeded on server startup
 */
export async function ensureDatabaseSeeded(): Promise<void> {
  try {
    // Check if Super Admin exists
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@proactivedata.in' },
    });

    const hashedAdmin = await bcrypt.hash('Admin@2026', 10);
    const hashedInv = await bcrypt.hash('Inv@2026', 10);
    const hashedEng = await bcrypt.hash('Eng@2026', 10);
    const hashedView = await bcrypt.hash('View@2026', 10);

    if (!admin) {
      logger.info('Creating default Super Admin user...');
      await prisma.user.create({
        data: {
          name: 'Super Admin',
          email: 'admin@proactivedata.in',
          password: hashedAdmin,
          role: 'SUPER_ADMIN',
          phone: '+91-9999999999',
          isActive: true,
        },
      });
    } else {
      // Force update password to Admin@123 to guarantee it works
      await prisma.user.update({
        where: { email: 'admin@proactivedata.in' },
        data: { password: hashedAdmin, isActive: true },
      });
    }

    // Ensure Inventory Admin
    await prisma.user.upsert({
      where: { email: 'inventory@proactivedata.in' },
      update: { password: hashedInv, isActive: true },
      create: {
        name: 'Inventory Admin',
        email: 'inventory@proactivedata.in',
        password: hashedInv,
        role: 'INVENTORY_ADMIN',
        isActive: true,
      },
    });

    // Ensure Field Engineer
    await prisma.user.upsert({
      where: { email: 'engineer@proactivedata.in' },
      update: { password: hashedEng, isActive: true },
      create: {
        name: 'Field Engineer',
        email: 'engineer@proactivedata.in',
        password: hashedEng,
        role: 'ENGINEER',
        isActive: true,
      },
    });

    // Ensure Read Only Viewer
    await prisma.user.upsert({
      where: { email: 'viewer@proactivedata.in' },
      update: { password: hashedView, isActive: true },
      create: {
        name: 'Read Only User',
        email: 'viewer@proactivedata.in',
        password: hashedView,
        role: 'READ_ONLY',
        isActive: true,
      },
    });

    logger.info('✅ Default users verified & ready (Admin@2026, Inv@2026, Eng@2026, View@2026)');
  } catch (error) {
    logger.error('Error during auto database seeding:', error);
  }
}
