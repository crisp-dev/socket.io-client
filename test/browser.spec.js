import { expect, test } from "@playwright/test";

const SERVER_URL = "http://127.0.0.1:39101";
const SILENT_URL = "http://127.0.0.1:39103";

test.beforeEach(async ({ page }) => {
  await page.goto("/test/browser/");
  await page.waitForFunction(() => window.socketIoTest);
});

test("exposes only the Crisp-facing entry points", async ({ page }) => {
  const result = await page.evaluate(() => {
    const client = window.socketIoTest;
    let relativeUrlError;

    try {
      client.io("/relative");
    } catch (error) {
      relativeUrlError = error.message;
    }

    return {
      defaultMatches: client.default === client.io,
      io: typeof client.io,
      socket: typeof client.Socket,
      removed: {
        connect: "connect" in client,
        manager: "Manager" in client,
        protocol: "protocol" in client,
      },
      relativeUrlError,
    };
  });

  expect(result).toEqual({
    defaultMatches: true,
    io: "function",
    socket: "function",
    removed: {
      connect: false,
      manager: false,
      protocol: false,
    },
    relativeUrlError: "An absolute Socket.IO URL is required",
  });
});

test("manually connects, exposes an ID and disconnects", async ({ page }) => {
  const result = await page.evaluate(async (serverUrl) => {
    const socket = window.socketIoTest.io(serverUrl, {
      autoConnect: false,
      reconnection: false,
      transports: ["websocket"],
    });
    const initial = {
      connected: socket.connected,
      disconnected: socket.disconnected,
      id: socket.id,
    };

    await new Promise((resolve) => {
      socket.on("connect", resolve);
      socket.connect();
    });

    const connected = {
      connected: socket.connected,
      disconnected: socket.disconnected,
      id: socket.id,
    };

    socket.disconnect();

    return {
      initial,
      connected,
      disconnected: {
        connected: socket.connected,
        disconnected: socket.disconnected,
        id: socket.id,
      },
    };
  }, SERVER_URL);

  expect(result.initial).toEqual({
    connected: false,
    disconnected: true,
    id: undefined,
  });
  expect(result.connected.connected).toBe(true);
  expect(result.connected.disconnected).toBe(false);
  expect(result.connected.id).toEqual(expect.any(String));
  expect(result.disconnected).toEqual({
    connected: false,
    disconnected: true,
    id: undefined,
  });
});

test("round-trips nested JSON events", async ({ page }) => {
  const payload = await page.evaluate(async (serverUrl) => {
    const socket = window.socketIoTest.io(serverUrl, {
      reconnection: false,
      transports: ["websocket"],
    });

    const response = new Promise((resolve) =>
      socket.on("server:echo", resolve),
    );
    await new Promise((resolve) => socket.on("connect", resolve));
    socket.emit("client:echo", {
      text: "hello",
      list: [1, false, null],
      nested: { ready: true },
    });

    const value = await response;
    socket.disconnect();
    return value;
  }, SERVER_URL);

  expect(payload).toEqual({
    text: "hello",
    list: [1, false, null],
    nested: { ready: true },
  });
});

test("flushes events emitted before a manual connection", async ({ page }) => {
  const payload = await page.evaluate(async (serverUrl) => {
    const socket = window.socketIoTest.io(serverUrl, {
      autoConnect: false,
      reconnection: false,
      transports: ["websocket"],
    });

    const response = new Promise((resolve) =>
      socket.on("server:buffered", resolve),
    );
    socket.emit("client:buffered", { queued: true });
    socket.connect();

    const value = await response;
    socket.disconnect();
    return value;
  }, SERVER_URL);

  expect(payload).toEqual({ queued: true });
});

test("reports a connection timeout", async ({ page }) => {
  const result = await page.evaluate(async (silentUrl) => {
    const socket = window.socketIoTest.io(silentUrl, {
      autoConnect: false,
      reconnection: false,
      timeout: 60,
      transports: ["websocket"],
    });

    const error = await new Promise((resolve) => {
      socket.on("connect_error", resolve);
      socket.connect();
    });

    socket.disconnect();
    return {
      connected: socket.connected,
      message: error.message,
    };
  }, SILENT_URL);

  expect(result).toEqual({
    connected: false,
    message: "timeout",
  });
});

test("emits reconnect attempts and failure", async ({ page }) => {
  const result = await page.evaluate(async (silentUrl) => {
    const socket = window.socketIoTest.io(silentUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 2,
      reconnectionDelay: 10,
      reconnectionDelayMax: 10,
      randomizationFactor: 0,
      timeout: 40,
      transports: ["websocket"],
    });
    const attempts = [];
    let connectErrors = 0;

    socket.on("connect_error", () => connectErrors++);
    socket.io.on("reconnect_attempt", (attempt) => attempts.push(attempt));

    await new Promise((resolve) => {
      socket.io.on("reconnect_failed", resolve);
      socket.connect();
    });

    socket.disconnect();
    return { attempts, connectErrors };
  }, SILENT_URL);

  expect(result.attempts).toEqual([1, 2]);
  expect(result.connectErrors).toBe(3);
});

test("does not reconnect when reconnection is disabled", async ({ page }) => {
  const result = await page.evaluate(async (silentUrl) => {
    const socket = window.socketIoTest.io(silentUrl, {
      autoConnect: false,
      reconnection: false,
      reconnectionDelay: 10,
      timeout: 40,
      transports: ["websocket"],
    });
    let attempts = 0;

    socket.io.on("reconnect_attempt", () => attempts++);
    await new Promise((resolve) => {
      socket.on("connect_error", resolve);
      socket.connect();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    socket.disconnect();
    return attempts;
  }, SILENT_URL);

  expect(result).toBe(0);
});

test("supports rescue URI and path mutation without reconnecting", async ({
  page,
}) => {
  const result = await page.evaluate(
    async ({ serverUrl, silentUrl }) => {
      const socket = window.socketIoTest.io(silentUrl, {
        autoConnect: false,
        reconnection: false,
        transports: ["websocket"],
      });

      socket.disconnect();
      socket.io.uri = serverUrl;
      socket.io.opts.path = "/socket.io";

      const rescued = {
        connected: socket.connected,
        uri: socket.io.uri,
        path: socket.io.opts.path,
      };

      await new Promise((resolve) => {
        socket.on("connect", resolve);
        socket.connect();
      });

      const connected = socket.connected;
      socket.disconnect();
      return { rescued, connected };
    },
    { serverUrl: SERVER_URL, silentUrl: SILENT_URL },
  );

  expect(result).toEqual({
    rescued: {
      connected: false,
      uri: SERVER_URL,
      path: "/socket.io",
    },
    connected: true,
  });
});
