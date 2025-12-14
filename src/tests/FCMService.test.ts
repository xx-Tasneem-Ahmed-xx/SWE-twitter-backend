const sendEachForMulticast = jest.fn();
const messaging = jest.fn(() => ({ sendEachForMulticast }));

jest.mock("@/application/services/firebaseInitializer", () => ({
  admin: {
    messaging,
  },
}));

import { sendPushNotification } from "@/application/services/FCMService";

describe("sendPushNotification", () => {
  const notification = { title: "Hello", body: "World" };
  const data = { count: 3, active: true, note: "hi", optional: undefined } as const;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty list when no tokens provided", async () => {
    const result = await sendPushNotification([], notification, data);

    expect(result).toEqual([]);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it("sends multicast message and returns invalid tokens", async () => {
    const tokens = ["valid-token", "bad-token-1", "bad-token-2"];
    const response = {
      successCount: 1,
      failureCount: 2,
      responses: [
        { success: true },
        { success: false, error: { code: "messaging/invalid-registration-token" } },
        { success: false, error: { code: "messaging/registration-token-not-registered" } },
      ],
    };

    sendEachForMulticast.mockResolvedValueOnce(response);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendPushNotification(tokens, notification, data);

    expect(messaging).toHaveBeenCalledTimes(1);
    expect(sendEachForMulticast).toHaveBeenCalledWith({
      notification,
      data: { count: "3", active: "true", note: "hi", optional: "" },
      tokens,
      apns: { headers: { "apns-priority": "10" } },
    });
    expect(result).toEqual(["bad-token-1", "bad-token-2"]);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it("ignores non-removable errors", async () => {
    const tokens = ["token-a", "token-b"];
    const response = {
      successCount: 0,
      failureCount: 2,
      responses: [
        { success: false, error: { code: "messaging/internal-error" } },
        { success: false, error: { code: "messaging/server-unavailable" } },
      ],
    };

    sendEachForMulticast.mockResolvedValueOnce(response);

    const result = await sendPushNotification(tokens, notification, data);

    expect(result).toEqual([]);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
  });

  it("returns empty list when send throws", async () => {
    const tokens = ["token-error"];
    sendEachForMulticast.mockRejectedValueOnce(new Error("send failed"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendPushNotification(tokens, notification, data);

    expect(result).toEqual([]);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
