// generateDependentData.ts
import { faker } from "@faker-js/faker";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
//import { userIDs } from './generateUsers'; // Import the user IDs generated in Step 1
import { hash } from "crypto";

// --- CONFIGURATION ---
const NUM_TWEETS: number = 500000; // Tweets
const NUM_FOLLOW_RECORDS: number = 600000; // 3 Million Follow relationships
const NUM_LIKE_RECORDS: number = 1000000; // 5 Million Likes
const NUM_RETWEET_RECORDS: number = 250000; // Example: 2.5 Million Retweet relationships
const NUM_TWEET_HASH_RECORDS: number = 1000000; // 3 Million Tweet-Hash links
const NUM_MENTION_RECORDS: number = 200000; // 1.5 Million Mentions
const NUM_USERS: number = 100000; // Example: 500k users
const USERS_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\users.csv";
const CATEGORIES_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\categories.csv";
const HASHES_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\hashes.csv";
const TWEET_HASH_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\tweetHashes.csv";
const MENTIONS_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\mentions.csv";
const RETWEETS_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\retweets.csv";
const TWEETS_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\tweets.csv";
const FOLLOWS_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\follows.csv";
const LIKES_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\tweetlikes.csv";
const MEDIA_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\medias.csv";
const TWEET_MEDIA_CSV_PATH: string =
  "D:\\cmp\\backend development\\SWE project\\SWE-twitter-backend\\prisma\\data\\tweetMedia.csv";

const UPLOADED_MEDIA_KEYNAMES: string[] = [
  "3648fb5c-a0b8-46d0-8163-f6111e4a6270-1764847371004-1000786114.jpg",
  "5184da42-7621-4ac2-b2c5-d9e41ff0ca87-1764773245309-Screenshot_20251201_122119_com.whatsapp.jpg",
  "5184da42-7621-4ac2-b2c5-d9e41ff0ca87-1764783004523-IMG-20251203-WA0038.jpg",
  "5184da42-7621-4ac2-b2c5-d9e41ff0ca87-1764848992455-VID-20251128-WA0036.mp4",
  "5184da42-7621-4ac2-b2c5-d9e41ff0ca87-1764849010098-IMG-20251203-WA0081.jpg",
  "5184da42-7621-4ac2-b2c5-d9e41ff0ca87-1764850747925-VID-20251128-WA0036.mp4",
  "5184da42-7621-4ac2-b2c5-d9e41ff0ca87-1764879012743-1000003427.mp4",
  "5184da42-7621-4ac2-b2c5-d9e41ff0ca87-1764938854486-1000003409.mp4",
  "c7209c3a-e63c-4e87-a514-a1320118ccdd-1764803985756-image_picker_750FD1B2-619A-441D-A4AA-B24383F07E2B-441-0000000148C83847.jpg",
  "c7209c3a-e63c-4e87-a514-a1320118ccdd-1764804219385-image_cropper_530EAEF4-7E5F-4FBD-AE16-BD8599588929-441-00000002577AD65F.jpg",
  "c7209c3a-e63c-4e87-a514-a1320118ccdd-1764804232691-image_cropper_6A1B8DAC-6AAC-4A17-A5B2-47DC1A75EFD0-441-00000002A5EB474B.jpg",
  "c7209c3a-e63c-4e87-a514-a1320118ccdd-1764804525358-image_picker_CA09D722-E650-4422-B2DD-FD05D956EFEA-441-000000045246CBA5.jpg",
  "f684123e-0fbb-4fda-a551-bc163f5f5d25-1764803819364-image_cropper_1764803811098.jpg",
  "f684123e-0fbb-4fda-a551-bc163f5f5d25-1764846901042-file0.mp4",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764793510495-image_cropper_3DDF2DFC-996D-437B-84FB-B34913A55026-405-00000000FC1C8715.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764793514038-image_cropper_BDF4DFEE-47BE-4ACA-B7E9-ACF0E0EECB48-405-000000011CEF749E.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764793568028-file0.mp4",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764793832856-image_cropper_5C8F31DC-0C12-4BF3-BA29-B67CFF0F704F-405-00000002EF0C52D1.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764798622469-image_picker_75E0D5DD-9C3C-4E86-9FD5-349F0A87F51E-738-00000010425DA965.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764941110724-1000962555.mp4",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764943233111-1000962555.mp4",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764943235280-1000962554.mp4",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764943519174-image_cropper_1764943511320.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764943549279-image_cropper_1764943537742.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764943551015-image_cropper_1764943545567.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764943754736-1000962555.mp4",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764943754755-1000961256.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764943754759-1000962554.mp4",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764947836025-image_cropper_1764947827131.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764948895827-image_cropper_1764948886084.jpg",
  "f762b111-3923-4011-9a40-6baeb6a744e2-1764954767573-1000961254.jpg",
];

// Array to store generated Media IDs
const mediaIDs: string[] = [];

export const userIDs: string[] = [];

// Array to store generated Tweet IDs for foreign key lookups
const TOPIC_NAMES: string[] = [
  "Sports",
  "News",
  "Entertainment",
  "Tech",
  "Music",
  "Politics",
  "Science",
  "Art",
  "Travel",
  "Food", // Added a few more for variety
];

// Array to store generated Hash IDs
const hashIDs: string[] = [];
const tweetIDs: string[] = [];

// Enum values must match your Prisma schema exactly
enum ReplyControl {
  EVERYONE = "EVERYONE",
  FOLLOWINGS = "FOLLOWINGS",
  MENTIONED = "MENTIONED",
}

enum TweetType {
  TWEET = "TWEET",
  REPLY = "REPLY",
  QUOTE = "QUOTE",
}

enum FollowStatus {
  ACCEPTED = "ACCEPTED",
  PENDING = "PENDING",
}

/**
 * Escapes double quotes inside a string and wraps the entire string in quotes.
 */
const safeString = (str: string | undefined | null): string => {
  if (str === undefined || str === null) return "";
  // Escape existing double quotes and wrap in quotes
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * Returns a random element from an array.
 */
const getRandomElement = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

export function generateUsers(): void {
  console.log(
    `\n➡️ Starting Level 0: Generating ${NUM_USERS.toLocaleString()} User records...`
  );

  // Ensure the output directory exists
  if (!fs.existsSync("data")) {
    fs.mkdirSync("data");
  }

  const stream = fs.createWriteStream(USERS_CSV_PATH);

  // 1. Write the CSV Header Row
  // Column order MUST match the table structure (excluding columns with defaults/nulls
  // that we don't need to explicitly seed)
  stream.write(
    `id,name,username,email,password,saltPassword,tokenVersion,joinDate,verified,protectedAccount,isEmailVerified,tfaVerifed,unseenChatCount,unseenNotificationCount,reputation,reputationUpdatedAt\n`
  );

  for (let i = 0; i < NUM_USERS; i++) {
    // 2. Generate and Track the UUID
    const id: string = uuidv4();
    userIDs.push(id);

    // 3. Generate Data
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const name = safeString(`${firstName} ${lastName}`);

    // Use a simple index-based approach for email/username to guarantee uniqueness
    // across the entire massive batch, as faker-js alone might eventually collide.
    const index = i.toString().padStart(6, "0");
    const username = `${faker.internet.username({
      firstName,
      lastName,
    })}${index}`;
    const email = `${username}@${faker.internet.domainName()}`;

    // Critical fields required by your schema:
    const password = faker.internet.password({ length: 60 });
    const saltPassword = faker.internet.password({ length: 20 });

    // Other non-nullable fields with defaults we explicitly set
    const tokenVersion = 0;
    const joinDate = faker.date.past({ years: 3 }).toISOString();
    const verified = faker.datatype.boolean();
    const protectedAccount = faker.datatype.boolean();
    const isEmailVerified = true;
    const tfaVerifed = faker.datatype.boolean();
    const unseenChatCount = 0;
    const unseenNotificationCount = 0;
    const reputation = 1.0;
    const reputationUpdatedAt = joinDate;

    // 4. Write the Row to CSV
    const rowData = [
      id,
      name,
      username,
      email,
      password,
      saltPassword,
      tokenVersion,
      joinDate,
      verified,
      protectedAccount,
      isEmailVerified,
      tfaVerifed,
      unseenChatCount,
      unseenNotificationCount,
      reputation,
      reputationUpdatedAt,
    ];

    stream.write(rowData.join(",") + "\n");

    if ((i + 1) % 100000 === 0) {
      console.log(`   - Generated ${(i + 1).toLocaleString()} users...`);
    }
  }

  stream.end();
  console.log(
    `✅ User data generation complete. File written to ${USERS_CSV_PATH}`
  );
}

// --- LEVEL 1: TWEETS GENERATION ---

function generateTweets(): void {
  if (userIDs.length === 0) {
    console.error("User IDs array is empty. Please run generateUsers() first.");
    return;
  }
  console.log(
    `\n➡️ Starting Level 1: Generating ${NUM_TWEETS.toLocaleString()} Tweet records...`
  );

  const stream = fs.createWriteStream(TWEETS_CSV_PATH);

  // Header Row: Must match the column names in your PostgreSQL 'tweets' table
  stream.write(
    `id,userId,content,createdAt,lastActivityAt,likesCount,retweetCount,repliesCount,quotesCount,replyControl,score,parentId,tweetType\n`
  );

  for (let i = 0; i < NUM_TWEETS; i++) {
    const id: string = uuidv4();
    tweetIDs.push(id); // Store Tweet ID for Level 2 relationships

    // Assign a random user as the author (userId is required)
    const userId: string = getRandomElement(userIDs);

    const createdAt: Date = faker.date.recent({ days: 365 });
    const lastActivityAt: Date = faker.date.soon({
      days: 10,
      refDate: createdAt,
    });

    // Simulate a distribution of tweet types and content
    const tweetType: TweetType = getRandomElement([
      TweetType.TWEET,
      TweetType.REPLY,
      TweetType.QUOTE,
    ]);
    let parentId: string | null = null;
    let content: string = faker.lorem.sentences({ min: 1, max: 3 });

    if (tweetType === TweetType.REPLY || tweetType === TweetType.QUOTE) {
      // Assign a parent tweet ID (only works if we already have some IDs generated)
      if (i > 100 && tweetIDs.length > 1) {
        // Get a random existing tweet ID, excluding the current one
        parentId = getRandomElement(tweetIDs.slice(0, i - 1));
        if (tweetType === TweetType.REPLY) {
          content = "Replying to previous tweet: " + content;
        }
      }
    }

    const likesCount = faker.number.int({ min: 0, max: 5000 });
    const retweetCount = faker.number.int({ min: 0, max: 500 });
    const repliesCount = faker.number.int({ min: 0, max: 100 });
    const quotesCount = faker.number.int({ min: 0, max: 100 });
    const replyControl: ReplyControl = getRandomElement(
      Object.values(ReplyControl)
    );
    const score = faker.number.float({ min: 0, max: 10, fractionDigits: 1 });

    const rowData = [
      id,
      userId,
      safeString(content),
      createdAt.toISOString(),
      lastActivityAt.toISOString(),
      likesCount,
      retweetCount,
      repliesCount,
      quotesCount,
      replyControl,
      score,
      parentId || "\\N", // PostgreSQL COPY requires \N for NULL values
      tweetType,
    ];

    stream.write(rowData.join(",") + "\n");
  }

  stream.end();
  console.log(
    `✅ Tweet data generation complete. File written to ${TWEETS_CSV_PATH}`
  );
}

// --- LEVEL 2: RELATIONAL DATA GENERATION ---

function generateFollows(): void {
  if (userIDs.length === 0) {
    console.error("User IDs array is empty. Cannot generate follow records.");
    return;
  }
  console.log(
    `\n➡️ Starting Level 2: Generating ${NUM_FOLLOW_RECORDS.toLocaleString()} Follow records...`
  );

  const stream = fs.createWriteStream(FOLLOWS_CSV_PATH);

  // Header Row: followerId, followingId, status (composite ID table)
  stream.write(`followerId,followingId,status\n`);

  const userSet = new Set(userIDs);
  const userArray = Array.from(userSet);

  for (let i = 0; i < NUM_FOLLOW_RECORDS; i++) {
    // Ensure followerId and followingId are distinct
    let followerId: string;
    let followingId: string;

    do {
      followerId = getRandomElement(userArray);
      followingId = getRandomElement(userArray);
    } while (followerId === followingId);

    const status: FollowStatus = getRandomElement(Object.values(FollowStatus));

    const rowData = [followerId, followingId, status];

    stream.write(rowData.join(",") + "\n");
  }

  stream.end();
  console.log(
    `✅ Follow data generation complete. File written to ${FOLLOWS_CSV_PATH}`
  );
}

function generateTweetLikes(): void {
  if (userIDs.length === 0 || tweetIDs.length === 0) {
    console.error(
      "User or Tweet IDs arrays are empty. Cannot generate like records."
    );
    return;
  }
  console.log(
    `\n➡️ Starting Level 2: Generating ${NUM_LIKE_RECORDS.toLocaleString()} TweetLike records...`
  );

  const stream = fs.createWriteStream(LIKES_CSV_PATH);

  // Header Row: tweetId, userId, createdAt (composite ID table)
  stream.write(`tweetId,userId,createdAt\n`);

  for (let i = 0; i < NUM_LIKE_RECORDS; i++) {
    const userId: string = getRandomElement(userIDs);
    const tweetId: string = getRandomElement(tweetIDs);
    const createdAt: Date = faker.date.recent({ days: 365 });

    const rowData = [tweetId, userId, createdAt.toISOString()];

    stream.write(rowData.join(",") + "\n");
  }

  stream.end();
  console.log(
    `✅ TweetLike data generation complete. File written to ${LIKES_CSV_PATH}`
  );
}

function generateRetweets(): void {
  if (userIDs.length === 0 || tweetIDs.length === 0) {
    console.error(
      "User or Tweet IDs arrays are empty. Cannot generate Retweet records."
    );
    return;
  }
  console.log(
    `\n➡️ Starting Level 2: Generating ${NUM_RETWEET_RECORDS.toLocaleString()} Retweet records...`
  );

  const stream = fs.createWriteStream(RETWEETS_CSV_PATH);

  // Header Row: userId, tweetId, createdAt (Matches the Retweet model columns)
  stream.write(`userId,tweetId,createdAt\n`);

  // Use a Set to track and prevent duplicate (userId, tweetId) pairs,
  // honoring the composite primary key constraint.
  const retweetSet = new Set<string>();
  let generatedCount = 0;

  while (generatedCount < NUM_RETWEET_RECORDS) {
    const userId: string = getRandomElement(userIDs);
    const tweetId: string = getRandomElement(tweetIDs);

    // Key for composite primary key check
    const key = `${userId}:${tweetId}`;

    if (!retweetSet.has(key)) {
      retweetSet.add(key);

      // Retweets are created over time, similar to likes
      const createdAt: Date = faker.date.recent({ days: 365 });

      const rowData = [userId, tweetId, createdAt.toISOString()];

      stream.write(rowData.join(",") + "\n");
      generatedCount++;

      if (generatedCount % 500000 === 0) {
        console.log(
          `   - Generated ${generatedCount.toLocaleString()} retweets...`
        );
      }
    }
  }

  stream.end();
  console.log(
    `✅ Retweet data generation complete. File written to ${RETWEETS_CSV_PATH}`
  );
}

// generateDependentData.ts (New functions)

// --- LEVEL 0/1: CATEGORIES & HASHS ---

function generateCategories(): void {
  console.log(
    `\n➡️ Starting Level 0: Generating ${TOPIC_NAMES.length} Category records...`
  );

  const stream = fs.createWriteStream(CATEGORIES_CSV_PATH);
  stream.write(`id,name,createdAt,updatedAt\n`);

  TOPIC_NAMES.forEach((name) => {
    const id: string = uuidv4();
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    const rowData = [id, name, createdAt, updatedAt];

    stream.write(rowData.join(",") + "\n");
  });

  stream.end();
  console.log(
    `✅ Category data generation complete. File written to ${CATEGORIES_CSV_PATH}`
  );
}

function generateHashes(): void {
  console.log(
    `\n➡️ Starting Level 0: Generating ${TOPIC_NAMES.length} Hash records...`
  );

  const stream = fs.createWriteStream(HASHES_CSV_PATH);
  // Note: tag_text is the unique identifier, similar to 'name'
  stream.write(`id,tag_text\n`);

  TOPIC_NAMES.forEach((topic) => {
    const id: string = uuidv4();
    // Hashtags are typically lowercase and snake_cased
    const tag_text = topic.toLowerCase().replace(/\s/g, "_");
    hashIDs.push(id); // Store Hash IDs for TweetHash links

    const rowData = [id, tag_text];

    stream.write(rowData.join(",") + "\n");
  });

  stream.end();
  console.log(
    `✅ Hash data generation complete. File written to ${HASHES_CSV_PATH}`
  );
}

// generateDependentData.ts (New function)

// --- LEVEL 2: TWEETHASH GENERATION ---

function generateTweetHashes(): void {
  if (tweetIDs.length === 0 || hashIDs.length === 0) {
    console.error(
      "Tweet or Hash IDs arrays are empty. Cannot generate TweetHash records."
    );
    return;
  }
  console.log(
    `\n➡️ Starting Level 2: Generating ${NUM_TWEET_HASH_RECORDS.toLocaleString()} TweetHash records...`
  );

  const stream = fs.createWriteStream(TWEET_HASH_CSV_PATH);

  // Header Row: tweetId, hashId (Composite primary key)
  stream.write(`tweetId,hashId\n`);

  const tweetHashSet = new Set<string>();
  let generatedCount = 0;

  while (generatedCount < NUM_TWEET_HASH_RECORDS) {
    const tweetId: string = getRandomElement(tweetIDs);
    const hashId: string = getRandomElement(hashIDs);

    const key = `${tweetId}:${hashId}`;

    if (!tweetHashSet.has(key)) {
      tweetHashSet.add(key);

      const rowData = [tweetId, hashId];

      stream.write(rowData.join(",") + "\n");
      generatedCount++;

      if (generatedCount % 500000 === 0) {
        console.log(
          `   - Generated ${generatedCount.toLocaleString()} TweetHashes...`
        );
      }
    }
  }

  stream.end();
  console.log(
    `✅ TweetHash data generation complete. File written to ${TWEET_HASH_CSV_PATH}`
  );
}

// generateDependentData.ts (New function)

// --- LEVEL 2: MENTION GENERATION ---

function generateMentions(): void {
  if (tweetIDs.length === 0 || userIDs.length < 2) {
    console.error(
      "Tweet or User IDs arrays are insufficient. Cannot generate Mention records."
    );
    return;
  }
  console.log(
    `\n➡️ Starting Level 2: Generating ${NUM_MENTION_RECORDS.toLocaleString()} Mention records...`
  );

  const stream = fs.createWriteStream(MENTIONS_CSV_PATH);

  // Header Row: tweetId, mentionerId, mentionedId (Composite primary key)
  stream.write(`tweetId,mentionerId,mentionedId\n`);

  const mentionSet = new Set<string>();
  let generatedCount = 0;

  while (generatedCount < NUM_MENTION_RECORDS) {
    const tweetId: string = getRandomElement(tweetIDs);

    let mentionerId: string = getRandomElement(userIDs);
    let mentionedId: string;

    // Ensure the mentioned user is different from the mentioner
    do {
      mentionedId = getRandomElement(userIDs);
    } while (mentionerId === mentionedId);

    const key = `${tweetId}:${mentionerId}:${mentionedId}`;

    if (!mentionSet.has(key)) {
      mentionSet.add(key);

      const rowData = [tweetId, mentionerId, mentionedId];

      stream.write(rowData.join(",") + "\n");
      generatedCount++;

      if (generatedCount % 500000 === 0) {
        console.log(
          `   - Generated ${generatedCount.toLocaleString()} Mentions...`
        );
      }
    }
  }

  stream.end();
  console.log(
    `✅ Mention data generation complete. File written to ${MENTIONS_CSV_PATH}`
  );
}

// generateDependentData.ts (New function)

// --- LEVEL 0: MEDIA GENERATION ---

function generateMedias(): void {
  console.log(
    `\n➡️ Starting Level 0: Generating ${UPLOADED_MEDIA_KEYNAMES.length} Media records...`
  );

  const stream = fs.createWriteStream(MEDIA_CSV_PATH);

  // Header Row: id, name, keyName, type, size
  stream.write(`id,name,keyName,type,size\n`);

  UPLOADED_MEDIA_KEYNAMES.forEach((keyName, index) => {
    const id: string = uuidv4();
    mediaIDs.push(id); // Store Media ID for TweetMedia links

    // Determine type based on keyName extension
    let type: string;
    if (keyName.includes(".mp4")) {
      type = "VIDEO";
    } else if (keyName.includes(".gif")) {
      type = "GIF";
    } else {
      type = "IMAGE";
    }

    const name = `Media ${index + 1}`;
    const size = faker.number.int({ min: 10000, max: 5000000 }); // Random size in bytes

    const rowData = [id, safeString(name), keyName, type, size];

    stream.write(rowData.join(",") + "\n");
  });

  stream.end();
  console.log(
    `✅ Media data generation complete. File written to ${MEDIA_CSV_PATH}`
  );
}

// generateDependentData.ts (New function)

// --- LEVEL 2: TWEETMEDIA GENERATION ---

function generateTweetMedias(): void {
  if (tweetIDs.length === 0 || mediaIDs.length === 0) {
    console.error(
      "Tweet or Media IDs arrays are empty. Cannot generate TweetMedia records."
    );
    return;
  }

  // We can only link as many records as we have media files
  const MAX_LINKS = Math.min(mediaIDs.length, tweetIDs.length);
  console.log(
    `\n➡️ Starting Level 2: Generating ${MAX_LINKS.toLocaleString()} TweetMedia records...`
  );

  const stream = fs.createWriteStream(TWEET_MEDIA_CSV_PATH);

  // Header Row: tweetId, mediaId (Composite primary key)
  stream.write(`tweetId,mediaId\n`);

  // Ensure we pick unique tweets to link the media to
  const availableTweetIDs = [...tweetIDs]; // Copy the array
  faker.helpers.shuffle(availableTweetIDs); // Randomize for better distribution

  for (let i = 0; i < MAX_LINKS; i++) {
    const mediaId: string = mediaIDs[i];
    const tweetId: string = availableTweetIDs[i]; // Use a unique, shuffled tweet ID

    // Key is not strictly necessary for uniqueness check since we iterate through unique mediaIds
    // and unique, shuffled tweetIds, but it keeps the pattern consistent.

    const rowData = [tweetId, mediaId];

    stream.write(rowData.join(",") + "\n");
  }

  stream.end();
  console.log(
    `✅ TweetMedia data generation complete. File written to ${TWEET_MEDIA_CSV_PATH}`
  );
}
// generateDependentData.ts (Updated Main Executor)

/**
 * Main execution function to run all generators in the correct order.
 */
export function generateAllDependentData(): void {
  console.log("\n--- Starting Dependent Data Generation ---");

  generateUsers(); // Ensure users are generated first
  // Level 0 (Independent/Static data)
  generateTweets();
  generateCategories();
  generateHashes();
  generateMedias(); // ⚡️ ADDED HERE

  // Level 1 (Primary data dependent on Users)

  // Level 2 (Join data dependent on Users, Tweets, and Media)
  generateFollows();
  generateTweetLikes();
  generateRetweets();
  generateTweetHashes();
  generateMentions();
  generateTweetMedias(); // ⚡️ ADDED HERE

  console.log("\n--- All Dependent Data Generation Complete ---");
}

// Execute the function when the script is run directly
if (require.main === module) {
  // This will only work correctly if userIDs has been pre-populated
  // You should run generateUsers.ts first to ensure the userIDs array is populated.

  // For a combined execution, import and run generateUsers() first, then run this.
  // For now, assume this is run after generateUsers.ts, and userIDs is available.
  generateAllDependentData();
}
