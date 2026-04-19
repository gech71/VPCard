import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Seeding database...");

  // Check if Super Admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  if (existingAdmin) {
    console.log("Super Admin already exists. Skipping...");
    await prisma.$disconnect();
    return;
  }

  // Create Super Admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@vpcard.com",
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
  });

  console.log("Super Admin created successfully!");
  console.log("Email: admin@vpcard.com");
  console.log("Password: admin123");
  console.log("Role: SUPER_ADMIN");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});
