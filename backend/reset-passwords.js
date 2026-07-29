/**
 * Password reset script using Prisma (already installed in backend)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const users = [
  { email: 'admin@proactivedata.in',     password: 'Admin@123', role: 'SUPER_ADMIN',     name: 'Super Admin',    phone: '+91-9999999999' },
  { email: 'inventory@proactivedata.in', password: 'Inv@123',   role: 'INVENTORY_ADMIN', name: 'Inventory Admin', phone: null },
  { email: 'engineer@proactivedata.in',  password: 'Eng@123',   role: 'ENGINEER',         name: 'Field Engineer',  phone: null },
  { email: 'viewer@proactivedata.in',    password: 'View@123',  role: 'READ_ONLY',        name: 'Read Only User',  phone: null },
];

async function resetPasswords() {
  console.log('\n🔄 Connecting to database...');

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);

    const existing = await prisma.user.findUnique({ where: { email: u.email } });

    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
        data: { password: hashed, isActive: true },
      });
      console.log(`🔑 Reset password: ${u.email}  →  ${u.password}`);
    } else {
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hashed,
          role: u.role,
          phone: u.phone,
          isActive: true,
        },
      });
      console.log(`➕ Created user:   ${u.email}  →  ${u.password}`);
    }

    // Revoke stale refresh tokens for this user
    if (existing) {
      await prisma.refreshToken.updateMany({
        where: { userId: existing.id },
        data: { isRevoked: true },
      });
    }
  }

  console.log('\n✅ Done! Login credentials:');
  console.log('─────────────────────────────────────────────────────');
  for (const u of users) {
    console.log(`  ${u.email.padEnd(38)} | ${u.password}`);
  }
  console.log('─────────────────────────────────────────────────────\n');
}

resetPasswords()
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
