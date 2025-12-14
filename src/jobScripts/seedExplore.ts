import { prisma } from "@/prisma/client";
import { enqueueSeedExploreFeedJob } from "@/background/jobs/explore";

export async function seedExploreCache() {
  const allTweets = await prisma.tweet.findMany({
    select: { id: true },
  });

  const tweetIds = allTweets.map((t) => t.id);

  await enqueueSeedExploreFeedJob({ tweetIds });

  console.log(`Enqueued seed job for ${tweetIds.length} tweets`);
}


