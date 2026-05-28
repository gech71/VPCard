import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const CARD_PROGRAMS_SEED: {
  code: string;
  name: string;
  bin: string;
}[] = [
  { code: "16441", name: "NIB Staff classic Card", bin: "956805" },
  { code: "18061", name: "CARDLESS NIB", bin: "987956805" },
  { code: "22461", name: "NIB LUCY CARD", bin: "956808" },
  { code: "22481", name: "NIB SETOTA CARD", bin: "956815" },
  { code: "22901", name: "NIB YENEGE TESFA", bin: "956807" },
  { code: "20861", name: "NIB Interest Free Card", bin: "956809" },
  { code: "22501", name: "NIB PLATINUM CARD", bin: "956806" },
  { code: "23341", name: "NIB Classic Card Green PIN", bin: "956805" },
  { code: "32141", name: "NIB MC VIRTUAL CARD", bin: "52624735" },
  { code: "29741", name: "NIB MC PREPAID CARD", bin: "54299767" },
];

const CUSTOMER_ID_MAPPING_SEED: {
  nibCusId: string;
  pssCusId: string;
}[] = [
  { nibCusId: "1006752907", pssCusId: "00002P00118289" },
  { nibCusId: "1000423265", pssCusId: "00002P00142501" },
  { nibCusId: "1010070712", pssCusId: "00002P00109265" },
  { nibCusId: "1010037452", pssCusId: "00002P00132573" },
  { nibCusId: "1010474731", pssCusId: "00002P00108917" },
  { nibCusId: "1004742926", pssCusId: "00002P00154277" },
  { nibCusId: "1006227706", pssCusId: "00002P00154457" },
];

async function seedCardPrograms(prisma: PrismaClient) {
  for (const p of CARD_PROGRAMS_SEED) {
    await prisma.cardProgram.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        bin: p.bin,
        enabledForMaker: true,
        enabledForSelf: true,
      },
      update: {
        name: p.name,
        bin: p.bin,
      },
    });
  }
}

async function seedCustomerIdMappings(prisma: PrismaClient) {
  for (const mapping of CUSTOMER_ID_MAPPING_SEED) {
    await prisma.customerIdMapping.upsert({
      where: { nibCusId: mapping.nibCusId },
      create: {
        nibCusId: mapping.nibCusId,
        pssCusId: mapping.pssCusId,
      },
      update: {
        pssCusId: mapping.pssCusId,
      },
    });
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await seedCardPrograms(prisma);
  await seedCustomerIdMappings(prisma);

  // Check if Super Admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  if (existingAdmin) {
    await prisma.$disconnect();
    return;
  }

  // Create Super Admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@vcminiapp.nibbank.com.et",
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed script error:", e);
  process.exit(1);
});
