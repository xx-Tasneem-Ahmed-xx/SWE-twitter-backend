// prisma/seedForYou.ts
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

  console.log("Clearing DB (careful!)");
  // delete in right order
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

  // USERS
  const users = [];
  for (let i = 0; i < 50; i++) {
    const u = await prisma.user.create({
      data: {
        username: `user${i}`,
        email: `user${i}@example.com`,
        password: `hashed-${i}`,
        saltPassword: `salt-${i}`,
        name: faker.person.fullName(),
        bio: faker.lorem.sentence(),
        verified: i % 10 === 0,
        dateOfBirth: faker.date.birthdate({ min: 18, max: 45, mode: "age" }),
      },
    });
    users.push(u);
  }

  // MEDIA (some profiles)
  const media = [];
  for (let i = 0; i < 20; i++) {
    const m = await prisma.media.create({
      data: {
        name: `img${i}.jpg`,
        keyName: `https://example.com/img${i}.jpg`,
        type: MediaType.IMAGE,
        size: 1024 + i,
      },
    });
    media.push(m);
  }
  // attach some profile media
  for (let i = 0; i < users.length && i < media.length; i++) {
    await prisma.user.update({
      where: { id: users[i].id },
      data: { profileMediaId: media[i].id },
    });
  }

  // HASHES (topics)
  const topics = [
    "sports",
    "news",
    "entertainment",
    "tech",
    "music",
    "politics",
  ];
  const hashRows = [];
  for (const t of topics) {
    const h = await prisma.hash.create({ data: { tag_text: t } });
    hashRows.push(h);
  }

  // TWEETS: create 500 tweets across topics and times
  const tweets = [];
  for (let i = 0; i < 500; i++) {
    const user = users[i % users.length];
    const topic = topics[i % topics.length];
    // random createdAt in last 7 days
    const createdAt = faker.date.recent({ days: 7 });
    const t = await prisma.tweet.create({
      data: {
        userId: user.id,
        content: `${faker.lorem.sentence()} #${topic}`,
        createdAt,
        lastActivityAt: createdAt,
        tweetType: TweetType.TWEET,
        replyControl: ReplyControl.EVERYONE,
        likesCount: faker.number.int({ min: 0, max: 200 }),
        retweetCount: faker.number.int({ min: 0, max: 100 }),
        repliesCount: faker.number.int({ min: 0, max: 50 }),
      },
    });
    tweets.push({ ...t, topic });
    // attach topic hashtag to tweet
    const tag = hashRows[topics.indexOf(topic)];
    await prisma.tweetHash.create({ data: { tweetId: t.id, hashId: tag.id } });
  }

  // FOLLOW GRAPH: provide a relatively dense graph (each user follows 6-12 others)
  for (const u of users) {
    const followCount = faker.number.int({ min: 6, max: 12 });
    const shuffled = faker.helpers.shuffle(users.map((x) => x.id));
    let added = 0;
    for (const targetId of shuffled) {
      if (targetId === u.id) continue;
      try {
        await prisma.follow.create({
          data: {
            followerId: u.id,
            followingId: targetId,
            status: FollowStatus.ACCEPTED,
          },
        });
        added++;
      } catch {
        // ignore duplicates
      }
      if (added >= followCount) break;
    }
  }

  // ENGAGEMENTS: likes & retweets skew to create trending tweets
  // Make some tweets viral by adding many likes/retweets
  const viralTweetCount = 10;
  for (let i = 0; i < viralTweetCount; i++) {
    const t = tweets[faker.number.int({ min: 0, max: tweets.length - 1 })];
    // add 50-200 likes
    for (let j = 0; j < faker.number.int({ min: 50, max: 200 }); j++) {
      const uid = users[faker.number.int({ min: 0, max: users.length - 1 })].id;
      try {
        await prisma.tweetLike.create({ data: { userId: uid, tweetId: t.id } });
      } catch {}
    }
    // add retweets
    for (let j = 0; j < faker.number.int({ min: 20, max: 120 }); j++) {
      const uid = users[faker.number.int({ min: 0, max: users.length - 1 })].id;
      try {
        await prisma.retweet.create({ data: { userId: uid, tweetId: t.id } });
      } catch {}
    }
  }

  // For every user, create some likes on tweets that match a topic they often post
  for (const u of users) {
    // pick 2 favorite topics
    const favs = faker.helpers.arrayElements(topics, 2);
    // pick 20 tweets matching those topics and like them
    const candidates = tweets.filter((t) => favs.includes(t.topic));
    const sample = faker.helpers.arrayElements(candidates, 20);
    for (const t of sample) {
      try {
        await prisma.tweetLike.create({
          data: { userId: u.id, tweetId: t.id },
        });
      } catch {}
    }
  }

  // Create some notifications and FCM tokens
  for (const u of users.slice(0, 10)) {
    await prisma.fcmToken.create({
      data: {
        token: `fcm-${faker.string.uuid()}`,
        osType: OSType.WEB,
        userId: u.id,
      },
    });
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
