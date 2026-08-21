import { ManagerOptions } from "./manager.js";
import { Socket } from "./socket.js";
export type ClientOptions = Partial<ManagerOptions>;
export declare function io(uri: string, opts?: ClientOptions): Socket;
export { Socket };
export default io;
