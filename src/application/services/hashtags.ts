import { extractHashtags } from "twitter-text";
import type { Prisma } from "@prisma/client";
import { AppError } from "@/errors/AppError";

// Extracts and normalizes hashtags from the given text.
export function extractAndNormalizeHashtags(text?: string | null): string[] {
  if (!text) return [];

  const rawTags = extractHashtags(text) || [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of rawTags) {
    if (!raw) continue;
    const tag = raw.trim().toLowerCase();
    if (tag.length === 0) continue;
    if (tag.length > 100) continue;
    if (!seen.has(tag)) {
      seen.add(tag);
      normalized.push(tag);
    }
  }
  return normalized;
}

// Helper: find existing hashes for a set of tags
export async function findExistingHashes(
  tx: Prisma.TransactionClient,
  tags: string[]
) {
  if (!tags || tags.length === 0)
    return [] as { id: string; tag_text: string }[];
  return tx.hash.findMany({
    where: { tag_text: { in: tags } },
    select: { id: true, tag_text: true },
  });
}

// Helper: create missing hashes in batch (skipDuplicates to tolerate races)
export async function createMissingHashes(
  tx: Prisma.TransactionClient,
  missingTags: string[]
) {
  if (!missingTags || missingTags.length === 0) return;
  await tx.hash.createMany({
    data: missingTags.map((tag) => ({ tag_text: tag })),
    skipDuplicates: true,
  });
}

// Helper: get all hashes (id + tag_text) for a set of tags
export async function getAllHashesByTags(
  tx: Prisma.TransactionClient,
  tags: string[]
) {
  if (!tags || tags.length === 0)
    return [] as { id: string; tag_text: string }[];
  return tx.hash.findMany({
    where: { tag_text: { in: tags } },
    select: { id: true, tag_text: true },
  });
}

// Helper: create tweet-hash relations in batch
export async function createTweetHashRelations(
  tx: Prisma.TransactionClient,
  tweetId: string,
  hashRows: { id: string; tag_text: string }[]
) {
  if (!hashRows || hashRows.length === 0) return;
  const tweetHashRows = hashRows.map((h) => ({ tweetId, hashId: h.id }));
  await tx.tweetHash.createMany({ data: tweetHashRows, skipDuplicates: true });
}

// Attach hashtags found in the text to the given tweet
export async function attachHashtagsToTweet(
  tweetId: string,
  text: string | null | undefined,
  tx: Prisma.TransactionClient
) {
  if (!tweetId) throw new AppError("Server Error: tweetId is required", 500);
  if (!tx)
    throw new AppError("Server Error: transaction client is required", 500);

  const tags = extractAndNormalizeHashtags(text);
  if (!tags || tags.length === 0) return;

  const existing = await findExistingHashes(tx, tags);
  const existingSet = new Set(existing.map((h) => h.tag_text));

  const missing = tags.filter((t) => !existingSet.has(t));
  await createMissingHashes(tx, missing);

  const allHashes = await getAllHashesByTags(tx, tags);
  await createTweetHashRelations(tx, tweetId, allHashes);
}
