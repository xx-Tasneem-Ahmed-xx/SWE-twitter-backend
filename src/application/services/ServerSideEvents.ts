import { Request, Response } from "express";
import { redisClient } from "@/config/redis";

const sseClients: Map<string, Response[]> = new Map();

export const SSErequest = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  //redisClient.lPush(`sse_clients_${userId}`, res as unknown as string);
  if (!sseClients.has(userId)) {
    sseClients.set(userId, []);
  }
  sseClients.get(userId)!.push(res);

  res.write("data: Connection established\n\n");
  const pingInterval = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000); // 15 seconds
  req.on("close", () => {
    console.log(`SSE disconnected for user ${userId}`);

    const remaining = (sseClients.get(userId) || []).filter((c) => c !== res);

    if (remaining.length > 0) {
      sseClients.set(userId, remaining);
    } else {
      sseClients.delete(userId);
    }

    res.end();
  });
};

export const sendSSEMessage = (
  userId: string,
  dataPayload: any,
  eventName: string = "message"
) => {
  const clients = sseClients.get(userId);
  if (!clients || clients.length === 0) return; // No clients connected

  const sseEvent =
    `event: ${eventName}\n` +
    `data: ${JSON.stringify(dataPayload)}\n\n`;

  const aliveClients: Response[] = [];

  for (const res of clients) {
    if (res.writableEnded) {
      continue;
    }

    try {
      res.write(sseEvent);
      aliveClients.push(res);
    } catch (error) {
      console.error("Error broadcasting to SSE client:", error);
      try {
        res.end();
      } catch {}
    }
  }

  if (aliveClients.length > 0) {
    sseClients.set(userId, aliveClients);
  } else {
    sseClients.delete(userId);
  }
};