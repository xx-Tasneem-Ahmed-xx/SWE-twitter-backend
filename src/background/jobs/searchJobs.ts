

// src/background/jobs/searchJobs.ts
import { searchIndexerQueue } from "../queues/index";

interface SearchIndexJobData {
  type: "full" | "incremental";
  limit?: number;
}

// Schedule full index (run once on startup or manually)
export const enqueueFullIndex = async () => {
  await searchIndexerQueue.add(
    "full-index",
    { type: "full" },
    {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    }
  );
  console.log("✅ Full index job scheduled");
};

// Schedule incremental update (run periodically)
export const enqueueIncrementalUpdate = async (limit: number = 200) => {
  await searchIndexerQueue.add(
    "incremental-update",
    { type: "incremental", limit },
    {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    }
  );
  console.log("✅ Incremental update job scheduled");
};

// Schedule recurring incremental updates using BullMQ's repeatable jobs
export const scheduleIncrementalUpdates = async () => {
  // Remove any existing repeatable jobs first
  const repeatableJobs = await searchIndexerQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await searchIndexerQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job (every 1 hour)
await searchIndexerQueue.add(
  "incremental-update",
  { type: "incremental", limit: 200 },
  {
    repeat: {
      every: 30_000, // 30 seconds (in ms)
    },
    removeOnComplete: true,
  }
);


  console.log("✅ Scheduled incremental updates every 1 hour");
};