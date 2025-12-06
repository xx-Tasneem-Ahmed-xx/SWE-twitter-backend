import { Request, Response } from "express";
import { redisClient } from "@/config/redis";

export const SSErequest = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  redisClient.lPush(`sse_clients_${userId}`, res as unknown as string);
  res.write("data: Connection established\n\n");
  const pingInterval = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000); // 15 seconds
  req.on("close", async () => {
    clearInterval(pingInterval);
    await redisClient.lRem(
      `sse_clients_${userId}`,
      1,
      res as unknown as string
    );
    res.end();
    console.log("Client disconnected");
  });
};

export const sendSSEMessage = async (
  userId: string,
  dataPayload: any,
  eventName: string = "message"
) => {
  const clients = await redisClient.lRange(`sse_clients_${userId}`, 0, -1);
  const sseEvent =
    `event: ${eventName}\n` + // Specify the custom event name
    `data: ${JSON.stringify(dataPayload)}\n\n`;
  for (const client of clients) {
    const res = client as unknown as Response;
    if (!res.writableEnded) {
      try {
        res.write(sseEvent);
      } catch (error) {
        console.error("Error writing to client stream:", error);
        await redisClient.lRem(
          `sse_clients_${userId}`,
          1,
          res as unknown as string
        );
        res.end();
      }
    }
  }
};
