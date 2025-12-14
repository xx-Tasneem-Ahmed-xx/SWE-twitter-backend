import { Request, Response } from "express";

const sseClients: Map<string, Response[]> = new Map();

export const SSErequest = (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173"); 
    res.setHeader("Access-Control-Allow-Credentials", "true"); 
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (!sseClients.has(userId)) {
      sseClients.set(userId, []);
    }
    sseClients.get(userId)!.push(res);

    console.log("SSE connected for user", userId);

    res.write("data: Connection established\n\n");

    const pingInterval = setInterval(() => {
      res.write(": ping\n\n");
    }, 30000);

    req.on("close", () => {
      clearInterval(pingInterval);
      console.log(`SSE disconnected for user ${userId}`);

      const remaining = (sseClients.get(userId) || []).filter((c) => c !== res);
      if (remaining.length > 0) {
        sseClients.set(userId, remaining);
      } else {
        sseClients.delete(userId);
      }

      res.end();
    });
  } catch (error) {
    console.error("Error establishing SSE connection:", error);
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
};

export const sendSSEMessage = (
  userId: string,
  dataPayload: any,
  eventName: string = "notification"
) => {
  const clients = sseClients.get(userId);
  if (!clients || clients.length === 0) return; // No clients connected

  const sseEvent =
    `event: ${eventName}\n` + `data: ${JSON.stringify(dataPayload)}\n\n`;

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
