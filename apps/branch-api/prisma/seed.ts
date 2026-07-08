import { PrismaClient } from '@prisma/client';
import { seedDefaults } from '../src/bootstrap/seed-defaults';

const prisma = new PrismaClient();

seedDefaults(prisma)
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
