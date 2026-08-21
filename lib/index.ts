import { Manager, ManagerOptions } from "./manager.js";
import { Socket } from "./socket.js";

export type ClientOptions = Partial<ManagerOptions>;

export function io(uri: string, opts: ClientOptions = {}): Socket {
  if (!/^(https?|wss?):\/\//.test(uri)) {
    throw new Error("An absolute Socket.IO URL is required");
  }

  return new Manager(uri, opts).socket();
}

export { Socket };
export default io;
