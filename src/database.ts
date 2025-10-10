import { PrismaClient } from "@prisma/client";

// Singleton pattern to prevent multiple Prisma instances
declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export async function connectToDatabase() {
  try {
    console.log("🔄 Connecting to database...");
    await prisma.$connect();
    console.log("✅ Successfully connected to the database!");

    // Test the connection
    const userCount = await prisma.user.count();
    console.log(`📊 Total users in database: ${userCount}`);

    return prisma;
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("too many connections")) {
      console.log(
        "💡 Tip: Wait a few minutes for connections to timeout, or restart your application"
      );
    }

    throw error;
  }
}

export async function disconnectFromDatabase() {
  try {
    await prisma.$disconnect();
    console.log("🔌 Disconnected from database");
  } catch (error) {
    console.error("❌ Error disconnecting from database:", error);
  }
}

export async function createSampleUser() {
  try {
    const user = await prisma.user.create({
      data: {
        username: `user_${Date.now()}`,
        email: `user_${Date.now()}@example.com`,
        password: "hashedpassword",
        saltPassword: "salt",
        token: "token",
        dateOfBirth: new Date("1990-01-01"),
        bio: "Sample user created for testing",
      },
    });

    console.log("✨ Created sample user:", user.username);
    return user;
  } catch (error) {
    console.error("❌ Error creating sample user:", error);
    throw error;
  }
}

// Export the prisma client for use in other files
export default prisma;
