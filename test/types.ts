import socketIo, { ClientOptions, io, Socket } from "../build/esm/index.js";

const options: ClientOptions = {
  autoConnect: false,
  closeOnBeforeunload: true,
  path: "/socket.io",
  randomizationFactor: 0.5,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ["websocket"],
  useNativeTimers: true,
};

const socket: Socket = io("https://example.com", options);
const defaultSocket: Socket = socketIo("https://example.com", options);

socket.on("connect", () => socket.id);
socket.on("disconnect", (reason) => reason);
socket.on("connect_error", (error) => error.message);
socket.on("message", (payload) => payload);
socket.emit("message", { nested: { ready: true } });
socket.io.on("reconnect_failed", () => undefined);
socket.io.uri = "https://rescue.example.com";
socket.io.opts.path = "/socket.io";
socket.connect();
socket.disconnect();
defaultSocket.disconnect();

// @ts-expect-error Socket.IO acknowledgement helpers are not supported.
socket.timeout(1000);

// @ts-expect-error Socket.IO transport modifiers are not supported.
socket.compress(false);

// @ts-expect-error Namespace authentication is not supported.
io("https://example.com", { auth: { token: "secret" } });
