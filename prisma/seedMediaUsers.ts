import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const media = await prisma.$transaction([
    prisma.media.create({
      data: {
        name: "fire",
        keyName: "https://cdn.example.com/photos/fire.jpg",
        type: "GIF",
        size: 204800,
      },
    }),
    prisma.media.create({
      data: {
        name: "shopping center",
        keyName: "https://cdn.example.com/photos/shopping.jpg",
        type: "IMAGE",
        size: 180000,
      },
    }),
    prisma.media.create({
      data: {
        name: "koka",
        keyName: "https://cdn.example.com/photos/koka.jpg",
        type: "VIDEO",
        size: 220000,
      },
    }),
    prisma.media.create({
      data: {
        name: "violet",
        keyName: "https://cdn.example.com/photos/violet.jpg",
        type: "IMAGE",
        size: 210000,
      },
    }),
    prisma.media.create({
      data: {
        name: "sun",
        keyName: "https://cdn.example.com/photos/sun.jpg",
        type: "IMAGE",
        size: 200000,
      },
    }),
  ]);

  await prisma.$transaction([
    prisma.user.upsert({
      where: { username: "alice" },
      update: {},
      create: {
        username: "alice",
        email: "alice@example.com",
        password: "alicePass123",
        saltPassword: "saltAlice",
        dateOfBirth: new Date("1995-04-12"),
        name: "Alice Johnson",
        bio: "Coffee lover. Cat mom. Product designer at Acme.",
        verified: true,
        protectedAccount: false,
      },
    }),
    prisma.user.upsert({
      where: { username: "bob" },
      update: {},
      create: {
        username: "bob",
        email: "bob@example.com",
        password: "bobPass456",
        saltPassword: "saltBob",
        dateOfBirth: new Date("1990-08-23"),
        name: "Bob Smith",
        bio: "Runner. Dad. Backend engineer.",
        verified: false,
        protectedAccount: false,
      },
    }),
    prisma.user.upsert({
      where: { username: "carol" },
      update: {},
      create: {
        username: "carol",
        email: "carol@example.com",
        password: "carolPass789",
        saltPassword: "saltCarol",
        dateOfBirth: new Date("1988-12-05"),
        name: "Carol Lee",
        bio: "Photographer. Traveler. Dreamer.",
        verified: true,
        protectedAccount: true,
      },
    }),
    prisma.user.upsert({
      where: { username: "dave" },
      update: {},
      create: {
        username: "dave",
        email: "dave@example.com",
        password: "davePass321",
        saltPassword: "saltDave",
        dateOfBirth: new Date("1992-06-30"),
        name: "Dave Brown",
        bio: "Cyclist. Musician. Software architect.",
        verified: false,
        protectedAccount: false,
      },
    }),
    prisma.user.upsert({
      where: { username: "eve" },
      update: {},
      create: {
        username: "eve",
        email: "eve@example.com",
        password: "evePass654",
        saltPassword: "saltEve",
        dateOfBirth: new Date("1998-11-15"),
        name: "Eve Davis",
        bio: "Gamer. Writer. Frontend developer.",
        verified: true,
        protectedAccount: false,
      },
    }),
  ]);

  console.log("Seeded 5 media and 5 users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
