import { DefaultEventsMap, EventsMap, Emitter } from "@socket.io/component-emitter";
import { Packet } from "./parser.js";
import { Socket } from "./socket.js";
interface EngineOptions {
    hostname?: string;
    secure?: boolean;
    port?: string | number;
    query?: Record<string, any>;
    path?: string;
    transports?: readonly string[];
    closeOnBeforeunload?: boolean;
    useNativeTimers?: boolean;
}
interface EngineSocket extends Emitter<any, any> {
    write(message: any, options?: any, callback?: any): this;
    close(): this;
}
export interface ManagerOptions extends EngineOptions {
    path: string;
    reconnection: boolean;
    reconnectionAttempts: number;
    reconnectionDelay: number;
    reconnectionDelayMax: number;
    randomizationFactor: number;
    timeout: number | boolean;
    autoConnect: boolean;
}
interface ManagerReservedEvents {
    open: () => void;
    error: (err: Error) => void;
    ping: () => void;
    packet: (packet: Packet) => void;
    close: (reason: string) => void;
    reconnect_failed: () => void;
    reconnect_attempt: (attempt: number) => void;
    reconnect_error: (err: Error) => void;
    reconnect: (attempt: number) => void;
}
export declare class Manager<ListenEvents extends EventsMap = DefaultEventsMap, EmitEvents extends EventsMap = ListenEvents> extends Emitter<{}, {}, ManagerReservedEvents> {
    engine: EngineSocket;
    uri: string;
    opts: Partial<ManagerOptions>;
    _autoConnect: boolean;
    _readyState: "opening" | "open" | "closed";
    _reconnecting: boolean;
    private socketInstance;
    private subs;
    private backoff;
    private setTimeoutFn;
    private clearTimeoutFn;
    private reconnectionEnabled;
    private reconnectionAttemptsLimit;
    private timeoutValue;
    private skipReconnect;
    private encoder;
    private decoder;
    constructor(uri: string, opts?: Partial<ManagerOptions>);
    open(callback?: (err?: Error) => void): this;
    socket(): Socket<ListenEvents, EmitEvents>;
    _destroy(socket: Socket): void;
    _packet(packet: Packet): void;
    _close(): void;
    private maybeReconnectOnOpen;
    private onopen;
    private cleanup;
    private onclose;
    private reconnect;
    private onreconnect;
}
export {};
