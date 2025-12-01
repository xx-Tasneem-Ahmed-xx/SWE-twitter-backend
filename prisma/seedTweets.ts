import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });
  if (users.length < 5) {
    throw new Error(
      "Expected at least 5 users in the database."
    );
  }

  const tweetsData = [
    {
      userId: users.find((u) => u.username === "alice")?.id!,
      content: "Excited to launch our new product at Acme! #startup #design",
    },
    {
      userId: users.find((u) => u.username === "alice")?.id!,
      content: "Coffee break and sketching new ideas.",
    },
    {
      userId: users.find((u) => u.username === "bob")?.id!,
      content: "5K run this morning. Feeling great! #running",
    },
    {
      userId: users.find((u) => u.username === "bob")?.id!,
      content: "Debugged a gnarly backend bug today. Victory!",
    },
    {
      userId: users.find((u) => u.username === "carol")?.id!,
      content: "Sunset photoshoot at the beach. Love this light!",
    },
    {
      userId: users.find((u) => u.username === "carol")?.id!,
      content: "Planning my next trip to Iceland. Suggestions?",
    },
    {
      userId: users.find((u) => u.username === "dave")?.id!,
      content: "Jamming with the band tonight.",
    },
    {
      userId: users.find((u) => u.username === "dave")?.id!,
      content: "Refactoring our architecture for better scalability.",
    },
    {
      userId: users.find((u) => u.username === "eve")?.id!,
      content: "Just published a new blog post on React hooks!",
    },
    {
      userId: users.find((u) => u.username === "eve")?.id!,
      content: "Levelled up in my favorite game tonight! #gamerlife",
    },
  ];

  await prisma.$transaction(
    tweetsData.map((tweet) =>
      prisma.tweet.create({
        data: {
          userId: tweet.userId,
          content: tweet.content,
          tweetType: "TWEET",
        },
      })
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
