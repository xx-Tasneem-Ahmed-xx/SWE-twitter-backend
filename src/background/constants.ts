export const GLOBAL_FEED_KEY = "explore:global";
export const CATEGORY_FEED_KEY = (category: string) =>
  `explore:category:${category}`;

export const FEED_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export const BATCH_SIZE = 500;
