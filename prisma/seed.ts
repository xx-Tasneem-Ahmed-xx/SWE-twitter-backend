import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function seed() {
  try {
    await prisma.user.deleteMany();

    const users = await prisma.user.createMany({
      data: [
        {
          name: "Alice Johnson",
          username: "alice",
          email: "alice@example.com",
          password: "hashed_password_1",
          saltPassword: "random_salt_1",
          dateOfBirth: new Date("1995-06-15"),
        },
        {
          name: "Bob Smith",
          username: "bob",
          email: "bob@example.com",
          password: "hashed_password_2",
          saltPassword: "random_salt_2",
          dateOfBirth: new Date("1993-03-20"),
        },
        {
          name: "Charlie Adams",
          username: "charlie",
          email: "charlie@example.com",
          password: "hashed_password_3",
          saltPassword: "random_salt_3",
          dateOfBirth: new Date("1990-12-02"),
        },
        {
          name: "David Lee",
          username: "david",
          email: "david@example.com",
          password: "hashed_password_4",
          saltPassword: "random_salt_4",
          dateOfBirth: new Date("1998-08-10"),
        },
        {
          name: "Eve Carter",
          username: "eve",
          email: "eve@example.com",
          password: "hashed_password_5",
          saltPassword: "random_salt_5",
          dateOfBirth: new Date("1997-09-25"),
        },
      ],
    });

    console.log(`✅ Seeded ${users.count} users successfully!`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
