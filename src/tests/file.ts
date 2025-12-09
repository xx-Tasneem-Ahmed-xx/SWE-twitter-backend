import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function test() {
  await prisma.user.create({
    data: {
      id: "123",
      username: "123",
      email: "123",
      password: "123",
      saltPassword: "salt123",
      dateOfBirth: new Date("2025-12-12"),
    },
  });
  const tweets = await prisma.tweet.createMany({
    data: [
      { content: "bla bla bla", userId: "123", tweetType: "TWEET" },
      { content: "bla bla bla", userId: "123", tweetType: "QUOTE" },
      { content: "bla bla bla", userId: "123", tweetType: "REPLY" },
    ],
  });
  console.log(tweets);
}
test()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
