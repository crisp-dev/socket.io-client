import { Manager } from "./manager.js";
import { Socket } from "./socket.js";
export function io(uri, opts = {}) {
    if (!/^(https?|wss?):\/\//.test(uri)) {
        throw new Error("An absolute Socket.IO URL is required");
    }
    return new Manager(uri, opts).socket();
}
export { Socket };
export default io;
