import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('secret123', 10);

  await prisma.user.upsert({
    where: { email: 'anton@daveenci.ai' },
    update: {},
    create: {
      email: 'anton@daveenci.ai',
      name: 'Anton Osipov',
      password,
    },
  });

  console.log('✅ Seed complete - User: anton@daveenci.ai');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  }); 