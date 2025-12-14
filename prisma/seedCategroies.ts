import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.category.createMany({
    data: [
      { name: "sports" },
      { name: "entertainment" },
      { name: "business & finance" },
      { name: "basketball" },
      { name: "fashion" },
      { name: "science" },
      { name: "cryptocurrency" },
      { name: "food" },
      { name: "american football" },
      { name: "gaming" },
      { name: "health & fitness" },
      { name: "finance" },
      { name: "shopping" },
      { name: "memes" },
      { name: "movies & tv" },
      { name: "music" },
      { name: "news" },
      { name: "politics" },
      { name: "celebrity" },
      { name: "soccer" },
      { name: "technology" },
      { name: "travel" },
      { name: "pets" },
      { name: "baseball" },
      { name: "stocks" },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect();
  });