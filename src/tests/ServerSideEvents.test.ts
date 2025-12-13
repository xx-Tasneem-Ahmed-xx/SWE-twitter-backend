import { EventEmitter } from "events";

describe("ServerSideEvents", () => {
  let SSErequest: any;
  let sendSSEMessage: any;

  const createReqRes = (userId = "user-1") => {
    const req = new EventEmitter() as any;
    req.params = { userId };

    const res: any = {
      headers: {} as Record<string, string>,
      writableEnded: false,
      statusCode: 200,
      headersSent: false,
      setHeader: jest.fn((key: string, value: string) => {
        res.headers[key] = value;
      }),
      write: jest.fn(),
      end: jest.fn(() => {
        res.writableEnded = true;
      }),
      status: jest.fn((code: number) => {
        res.statusCode = code;
        res.headersSent = true;
        return res;
      }),
    };

    return { req, res };
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.resetModules();
    const mod = await import("@/application/services/ServerSideEvents");
    SSErequest = mod.SSErequest;
    sendSSEMessage = mod.sendSSEMessage;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("registers client and sends event", () => {
    const { req, res } = createReqRes("user-abc");

    SSErequest(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "http://localhost:5173"
    );
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
    expect(res.write).toHaveBeenCalledWith("data: Connection established\n\n");

    sendSSEMessage("user-abc", { msg: "hi" }, "custom");
    expect(res.write).toHaveBeenCalledWith(
      "event: custom\n" + "data: {\"msg\":\"hi\"}\n\n"
    );

    req.emit("close");
    jest.runOnlyPendingTimers();
    expect(res.end).toHaveBeenCalled();
  });

  it("removes client on close", () => {
    const { req, res } = createReqRes("user-close");
    SSErequest(req, res);

    req.emit("close");
    jest.runOnlyPendingTimers();

    sendSSEMessage("user-close", { msg: "after-close" });
    expect(res.write).toHaveBeenCalledTimes(1);
    expect(res.end).toHaveBeenCalled();
  });

  it("skips ended responses and retains alive ones", () => {
    const first = createReqRes("user-multi");
    const second = createReqRes("user-multi");

    SSErequest(first.req, first.res);
    SSErequest(second.req, second.res);

    second.res.writableEnded = true;

    sendSSEMessage("user-multi", { ok: true });

    expect(first.res.write).toHaveBeenCalledWith(
      "event: notification\n" + "data: {\"ok\":true}\n\n"
    );
    expect(second.res.write).toHaveBeenCalledTimes(1);

    first.req.emit("close");
    second.req.emit("close");
    jest.runOnlyPendingTimers();
  });

  it("does nothing when no clients", () => {
    expect(() => sendSSEMessage("missing", { a: 1 })).not.toThrow();
  });
});
