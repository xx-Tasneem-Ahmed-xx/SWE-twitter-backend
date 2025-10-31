// import { PrismaClient } from "@prisma/client";
// const prisma = new PrismaClient();

// async function seed() {
//   try {
//     await prisma.user.deleteMany();

//     const users = await prisma.user.createMany({
//       data: [
//         {
//           name: "Alice Johnson",
//           username: "alice",
//           email: "alice@example.com",
//           password: "hashed_password_1",
//           saltPassword: "random_salt_1",
//           dateOfBirth: new Date("1995-06-15"),
//         },
//         {
//           name: "Bob Smith",
//           username: "bob",
//           email: "bob@example.com",
//           password: "hashed_password_2",
//           saltPassword: "random_salt_2",
//           dateOfBirth: new Date("1993-03-20"),
//         },
//         {
//           name: "Charlie Adams",
//           username: "charlie",
//           email: "charlie@example.com",
//           password: "hashed_password_3",
//           saltPassword: "random_salt_3",
//           dateOfBirth: new Date("1990-12-02"),
//         },
//         {
//           name: "David Lee",
//           username: "david",
//           email: "david@example.com",
//           password: "hashed_password_4",
//           saltPassword: "random_salt_4",
//           dateOfBirth: new Date("1998-08-10"),
//         },
//         {
//           name: "Eve Carter",
//           username: "eve",
//           email: "eve@example.com",
//           password: "hashed_password_5",
//           saltPassword: "random_salt_5",
//           dateOfBirth: new Date("1997-09-25"),
//         },
//       ],
//     });

//     console.log(`✅ Seeded ${users.count} users successfully!`);
//   } catch (error) {
//     console.error("❌ Seeding failed:", error);
//     process.exit(1);
//   } finally {
//     await prisma.$disconnect();
//   }
// }

// seed();

//====================================================================//
import {
  PrismaClient,
  MediaType,
  TweetType,
  MessageStatus,
  NotificationTitle,
  FollowStatus,
  OSType,
  ReplyControl,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { faker } = await import("@faker-js/faker");

  console.log("Clearing existing data...");

  // Order matters — delete child tables first, then parents
  await prisma.notification.deleteMany();
  await prisma.tweetBookmark.deleteMany();
  await prisma.tweetLike.deleteMany();
  await prisma.retweet.deleteMany();
  await prisma.messageMedia.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chatUser.deleteMany();
  await prisma.chatGroup.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.block.deleteMany();
  await prisma.mute.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.mention.deleteMany();
  await prisma.tweetMedia.deleteMany();
  await prisma.tweetHash.deleteMany();
  await prisma.hash.deleteMany();
  await prisma.tweetSummary.deleteMany();
  await prisma.tweet.deleteMany();
  await prisma.oldPassword.deleteMany();
  await prisma.deviceRecord.deleteMany();
  await prisma.session.deleteMany();
  await prisma.fcmToken.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.media.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding fresh data...");

  // ====== USERS (5) ======
  const users = [];
  for (let i = 1; i <= 5; i++) {
    const u = await prisma.user.create({
      data: {
        id: `u${i}`,
        username: `test_user${i}`,
        email: `test_user${i}@example.com`,
        password: `hashedPassword${i}`,
        saltPassword: `salt${i}`,
        name: faker.person.fullName(),
        bio: faker.lorem.sentence(),
        verified: i % 2 === 0,
        protectedAccount: false,
        dateOfBirth: faker.date.birthdate({ min: 18, max: 40, mode: "age" }),
      },
    });
    users.push(u);
  }

  // ====== MEDIA (5) ======
  const medias = [];
  for (let i = 1; i <= 5; i++) {
    const m = await prisma.media.create({
      data: {
        name: `photo${i}.jpg`,
        keyName: `https://example.com/photo${i}.jpg`,
        type: MediaType.IMAGE,
        size: faker.number.int({ min: 500, max: 5000 }),
      },
    });
    medias.push(m);
  }

  // ====== PROFILE + COVER IMAGES ======
  await prisma.user.update({
    where: { id: users[0].id },
    data: { profileMediaId: medias[0].id, coverMediaId: medias[1].id },
  });
  await prisma.user.update({
    where: { id: users[1].id },
    data: { profileMediaId: medias[2].id },
  });
  await prisma.user.update({
    where: { id: users[2].id },
    data: { coverMediaId: medias[3].id },
  });

  // ====== TWEETS ======
  const tweets = [];
  for (let i = 1; i <= 5; i++) {
    const t = await prisma.tweet.create({
      data: {
        userId: users[(i - 1) % users.length].id,
        content: faker.lorem.sentences(1),
        tweetType: TweetType.TWEET,
        replyControl: ReplyControl.EVERYONE,
      },
    });
    tweets.push(t);
  }

  // ====== TWEET SUMMARY ======
  for (let i = 0; i < 5; i++) {
    await prisma.tweetSummary.create({
      data: { tweetId: tweets[i].id, summary: faker.lorem.sentence() },
    });
  }

  // ====== HASH + TWEETHASH ======
  const hashes = [];
  for (let i = 1; i <= 5; i++) {
    const h = await prisma.hash.create({
      data: { tag_text: `tag${i}` },
    });
    hashes.push(h);
  }
  for (let i = 0; i < 5; i++) {
    await prisma.tweetHash.create({
      data: { tweetId: tweets[i].id, hashId: hashes[i].id },
    });
  }

  // ====== TWEET MEDIA ======
  for (let i = 0; i < 5; i++) {
    await prisma.tweetMedia.create({
      data: { tweetId: tweets[i].id, mediaId: medias[i].id },
    });
  }

  // ====== MENTIONS ======
  for (let i = 0; i < 5; i++) {
    await prisma.mention.create({
      data: {
        tweetId: tweets[i].id,
        mentionerId: users[i].id,
        mentionedId: users[(i + 1) % users.length].id,
      },
    });
  }

  // ====== FOLLOW / MUTE / BLOCK ======
  for (let i = 0; i < 5; i++) {
    await prisma.follow.create({
      data: {
        followerId: users[i].id,
        followingId: users[(i + 1) % users.length].id,
        status: i % 2 === 0 ? FollowStatus.ACCEPTED : FollowStatus.PENDING,
      },
    });

    await prisma.mute.create({
      data: { muterId: users[i].id, mutedId: users[(i + 2) % users.length].id },
    });

    await prisma.block.create({
      data: {
        blockerId: users[i].id,
        blockedId: users[(i + 3) % users.length].id,
      },
    });
  }

  // ====== CHATS + CHAT GROUPS ======
  const chats = [];
  for (let i = 1; i <= 5; i++) {
    const c = await prisma.chat.create({
      data: { DMChat: i % 2 === 0 },
    });
    chats.push(c);

    if (!c.DMChat) {
      await prisma.chatGroup.create({
        data: {
          chatId: c.id,
          name: `Group ${i}`,
          description: `Chat group ${i}`,
          photo: medias[i - 1].keyName,
        },
      });
    }
  }

  // ====== CHAT USERS ======
  for (let i = 0; i < 5; i++) {
    await prisma.chatUser.create({
      data: { userId: users[i].id, chatId: chats[i].id },
    });
    if (chats[i].DMChat === true) {
      await prisma.chatUser.create({
        data: { userId: users[(i + 1) % users.length].id, chatId: chats[i].id },
      });
    }
  }

  // ====== MESSAGES + MESSAGE MEDIA ======
  const messages = [];
  for (let i = 0; i < 5; i++) {
    const m = await prisma.message.create({
      data: {
        chatId: chats[i].id,
        userId: users[i].id,
        content: faker.lorem.sentence(),
        status: MessageStatus.SENT,
      },
    });
    messages.push(m);

    await prisma.messageMedia.create({
      data: { messageId: m.id, mediaId: medias[i].id },
    });
  }

  // ====== RETWEETS / LIKES / BOOKMARKS ======
  for (let i = 0; i < 5; i++) {
    await prisma.retweet.create({
      data: {
        userId: users[i].id,
        tweetId: tweets[(i + 1) % tweets.length].id,
      },
    });

    await prisma.tweetLike.create({
      data: {
        userId: users[i].id,
        tweetId: tweets[(i + 2) % tweets.length].id,
      },
    });

    await prisma.tweetBookmark.create({
      data: { userId: users[i].id, tweetId: tweets[i].id },
    });
  }

  // ====== NOTIFICATIONS ======
  for (let i = 0; i < 5; i++) {
    await prisma.notification.create({
      data: {
        title: NotificationTitle.LIKE,
        body: faker.lorem.sentence(),
        isRead: false,
        userId: users[i].id,
        tweetId: tweets[i].id,
        actorId: users[(i + 1) % users.length].id,
      },
    });
  }

  // ====== SESSIONS ======
  for (let i = 0; i < 5; i++) {
    await prisma.session.create({
      data: {
        jti: `sess-${faker.string.uuid()}`,
        userId: users[i].id,
        isActive: true,
        expire_at: faker.date.soon({ days: 30 }),
      },
    });
  }

  // ====== DEVICE RECORDS ======
  for (let i = 0; i < 5; i++) {
    await prisma.deviceRecord.create({
      data: {
        userId: users[i].id,
        city: faker.location.city(),
        region: faker.location.state(),
        country: faker.location.country(),
        locale: "en-US",
        lastLogin: faker.date.recent(),
        browser: faker.internet.userAgent(),
      },
    });
  }

  // ====== OLD PASSWORDS ======
  for (let i = 0; i < 5; i++) {
    await prisma.oldPassword.create({
      data: { userId: users[i].id, password: `oldHashedPassword${i + 1}` },
    });
  }

  // ====== OAUTH ACCOUNTS ======
  for (let i = 0; i < 5; i++) {
    await prisma.oAuthAccount.create({
      data: {
        provider: i % 2 === 0 ? "google" : "facebook",
        providerId: `prov-${i + 1}`,
        userId: users[i].id,
      },
    });
  }

  // ====== FCM TOKENS ======
  for (let i = 0; i < 5; i++) {
    await prisma.fcmToken.create({
      data: {
        token: `fcm-${faker.string.uuid()}`,
        osType: OSType.WEB,
        userId: users[i].id,
      },
    });
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
