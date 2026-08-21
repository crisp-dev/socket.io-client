import { createServer } from "node:http";
import { Server } from "socket.io";

const socketServer = createServer();
const silentServer = createServer();
const io = new Server(socketServer, {
  transports: ["websocket"],
  pingInterval: 500,
  pingTimeout: 500,
});

io.on("connection", (socket) => {
  socket.emit("server:ready", {
    id: socket.id,
    nested: { enabled: true },
  });

  socket.on("client:echo", (payload) => {
    socket.emit("server:echo", payload);
  });

  socket.on("client:buffered", (payload) => {
    socket.emit("server:buffered", payload);
  });
});

silentServer.on("upgrade", () => {
  // Keep the WebSocket handshake pending to exercise connection timeouts.
});

await Promise.all([
  new Promise((resolve) => socketServer.listen(39101, "127.0.0.1", resolve)),
  new Promise((resolve) => silentServer.listen(39103, "127.0.0.1", resolve)),
]);

function shutdown() {
  io.close();
  silentServer.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
