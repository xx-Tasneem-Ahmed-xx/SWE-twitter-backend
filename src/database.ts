import { getSecrets } from "./config/secrets";
import { prisma as clientPrisma } from "@/prisma/client";

const prisma = clientPrisma;

export async function connectToDatabase() {
  try {
    const { NODE_ENV } = getSecrets();

    console.log(`Connecting to database in ${NODE_ENV} mode...`);

    const connectWithTimeout = Promise.race([
      prisma.$connect(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Database connection timeout")),
          15000
        )
      ),
    ]);

    await connectWithTimeout;
    console.log("Successfully connected to the database!");

    const userCount = await prisma.user.count();
    console.log(`Total users in database: ${userCount}`);

    return prisma;
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    throw error;
  }
}

export async function disconnectFromDatabase() {
  try {
    await prisma.$disconnect();
    console.log("Disconnected from database");
  } catch (error) {
    console.error("Error disconnecting from database:", error);
  }
}

(prisma as any).connectToDatabase = connectToDatabase;
(prisma as any).disconnectFromDatabase = disconnectFromDatabase;

export default prisma;
