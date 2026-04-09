const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function addUsers() {
  const users = [];
  for (let i = 1; i <= 1000; i++) {
    users.push({
      email: `test_user_${i}@example.com`,
      deviceLimit: Math.floor(Math.random() * 5) + 1,
      // Random expiry between 1 day and 60 days from now
      expiresAt: new Date(
        Date.now() + (Math.random() * 60 + 1) * 24 * 60 * 60 * 1000,
      ),
    });
  }

  await prisma.user.createMany({
    data: users,
  });
  console.log("✅ เพิ่มผู้ใช้งานทดสอบ 1,000 คนเรียบร้อยแล้ว");
}

async function removeUsers() {
  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: "test_user_",
      },
    },
  });
  console.log("🗑️ ลบผู้ใช้งานทดสอบ 1,000 คนเรียบร้อยแล้ว");
}

const action = process.argv[2];

if (action === "add") {
  addUsers().finally(() => prisma.$disconnect());
} else if (action === "remove") {
  removeUsers().finally(() => prisma.$disconnect());
} else {
  console.log(
    "Please specify action: 'node seed-users.js add' or 'node seed-users.js remove'",
  );
  prisma.$disconnect();
}
