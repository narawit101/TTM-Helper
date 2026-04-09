import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";

const connectionString = env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

type AdminRecord = {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
};

type UserRecord = {
  id: string;
  email: string;
  createdAt: Date;
  expiresAt: Date | null;
  deviceLimit: number;
};

type DeviceRecord = {
  id: string;
  userId: string;
  deviceKey: string;
  deviceName: string | null;
  createdAt: Date;
};

type UserWithDevicesRecord = UserRecord & {
  devices: DeviceRecord[];
};

type AppPrismaClient = PrismaClient & {
  admin: {
    findUnique: (args: { where: { email: string } }) => Promise<AdminRecord | null>;
    findMany: (args: { orderBy: { createdAt: "asc" | "desc" } }) => Promise<AdminRecord[]>;
    upsert: (args: {
      where: { email: string };
      update: Partial<Pick<AdminRecord, "password">>;
      create: Pick<AdminRecord, "email" | "password">;
    }) => Promise<AdminRecord>;
  };
  user: {
    findUnique: (args: {
      where: { email: string };
      include?: { devices?: boolean };
    }) => Promise<UserWithDevicesRecord | UserRecord | null>;
    findMany: (args: { orderBy: { createdAt: "asc" | "desc" } }) => Promise<UserRecord[]>;
    upsert: (args: {
      where: { email: string };
      update: Partial<Pick<UserRecord, "expiresAt" | "deviceLimit">>;
      create: Pick<UserRecord, "email" | "expiresAt" | "deviceLimit">;
    }) => Promise<UserRecord>;
  };
  device: {
    create: (args: {
      data: Pick<DeviceRecord, "userId" | "deviceKey" | "deviceName">;
    }) => Promise<DeviceRecord>;
  };
};

const globalForPrisma = globalThis as unknown as {
  prisma?: AppPrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  (new PrismaClient({ adapter }) as AppPrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
