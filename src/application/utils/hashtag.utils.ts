export type TrendData = {
  id: string; // Encoded hashtag ID
  hashtag: string;
  tweetCount: number;
  likesCount: number;
  score: number;
  rank: number;
};

export enum TrendCategory {
  Global = "global",
  News = "news",
  Sports = "sports",
  Entertainment = "entertainment",
}

// builds the next cursor for pagination based on the last tweet in the current page
export const buildNextCursor = (
  tweets: any[],
  hasMore: boolean,
  encoderService: any
) => {
  if (!hasMore || tweets.length === 0) return null;

  const last = tweets[tweets.length - 1];

  return encoderService.encode({
    id: last.id,
    createdAt: last.createdAt
      ? last.createdAt.toISOString()
      : new Date().toISOString(),
  });
};

// builds a cursor condition for pagination based on the provided cursor
export const buildCursorCondition = (
  cursor?: {
    id: string;
    createdAt: string;
  } | null
) => {
  if (!cursor) return {};
  const cursorDate = new Date(cursor.createdAt);
  return {
    OR: [
      { createdAt: { lt: cursorDate } },
      { AND: [{ createdAt: cursorDate }, { id: { lt: cursor.id } }] },
    ],
  };
};

// Get user IDs that should be excluded (blocked/muted users)
export const getExcludedUserIds = async (
  userId: string,
  prisma: any
): Promise<string[]> => {
  const [blockedByMe, blockedMe, mutedByMe] = await Promise.all([
    prisma.block.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    }),
    prisma.block.findMany({
      where: { blockedId: userId },
      select: { blockerId: true },
    }),
    prisma.mute.findMany({
      where: { muterId: userId },
      select: { mutedId: true },
    }),
  ]);

  return [
    ...blockedByMe.map((b: { blockedId: string }) => b.blockedId),
    ...blockedMe.map((b: { blockerId: string }) => b.blockerId),
    ...mutedByMe.map((m: { mutedId: string }) => m.mutedId),
  ];
};

// Filter out tweets from blocked/muted users
export const filterBlockedAndMutedTweets = async (
  tweets: any[],
  userId: string,
  prisma: any
): Promise<any[]> => {
  if (!tweets.length) return tweets;

  const excludedUserIds = await getExcludedUserIds(userId, prisma);
  const excludedSet = new Set(excludedUserIds);

  return tweets.filter((tweet: any) => !excludedSet.has(tweet.userId));
};

// viral score calculation for a tweet
export const viralScore = (t: any) => {
  return (
    Number(t.likesCount ?? 0) * 0.6 +
    Number(t.retweetCount ?? 0) * 0.3 +
    Number(t.repliesCount ?? 0) * 0.08 +
    Number(t.quotesCount ?? 0) * 0.02
  );
};

// sort tweets by viral score in descending order
export const sortByViral = (tweets: any[]) =>
  tweets.slice().sort((a, b) => viralScore(b) - viralScore(a));

// Calculate trend scores
export const calculateTrendScores = (
  entries: { tweetCount: number; likesSum: number; hashId: string }[]
) => {
  const maxTweet = Math.max(...entries.map((e) => e.tweetCount));
  const maxLikes = Math.max(...entries.map((e) => e.likesSum));
  const tweetWeight = 0.63;
  const likesWeight = 0.37;

  return entries.map((e) => ({
    ...e,
    score:
      (maxTweet > 0 ? e.tweetCount / maxTweet : 0) * tweetWeight +
      (maxLikes > 0 ? e.likesSum / maxLikes : 0) * likesWeight,
  }));
};

// Sort by score and limit
export const sortAndTake = <T extends { score: number }>(
  entries: T[],
  limit: number
) => {
  const sorted = entries.sort((a, b) => b.score - a.score);
  return sorted.slice(0, limit);
};

// Map hashId + data -> TrendData
export const mapToTrendData = async (
  entries: {
    hashId: string;
    tweetCount: number;
    likesSum: number;
    score: number;
  }[],
  prisma: any
): Promise<TrendData[]> => {
  if (entries.length === 0) return [];

  const hashIds = entries.map((t) => t.hashId);
  const hashes = await prisma.hash.findMany({
    where: { id: { in: hashIds } },
    select: { id: true, tag_text: true },
  });
  const hashMap = new Map(
    hashes.map(
      (h: { id: string; tag_text: string }) =>
        [h.id, h.tag_text] as [string, string]
    )
  );

  return entries
    .map((item, index) => {
      const hashtag = hashMap.get(item.hashId);
      if (!hashtag) return null;

      return {
        id: item.hashId,
        hashtag,
        tweetCount: item.tweetCount,
        likesCount: item.likesSum,
        score: Number((item.score ?? 0).toFixed(4)),
        rank: index + 1,
      };
    })
    .filter((t): t is TrendData => t !== null);
};
