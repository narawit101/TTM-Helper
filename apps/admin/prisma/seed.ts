import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.admin.upsert({
    where: {
      email: adminEmail
    },
    update: {
      password: hashedPassword
    },
    create: {
      email: adminEmail,
      password: hashedPassword
    }
  });

  await prisma.user.upsert({
    where: {
      email: "user1@example.com"
    },
    update: {
      expiresAt: null,
      deviceLimit: 1
    },
    create: {
      email: "user1@example.com",
      expiresAt: null,
      deviceLimit: 1
    }
  });

  await prisma.user.upsert({
    where: {
      email: "user2@example.com"
    },
    update: {
      expiresAt: null,
      deviceLimit: 3
    },
    create: {
      email: "user2@example.com",
      expiresAt: null,
      deviceLimit: 3
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
