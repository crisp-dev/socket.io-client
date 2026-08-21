import { DefaultEventsMap, EventNames, EventParams, EventsMap, Emitter } from "@socket.io/component-emitter";
import { Manager } from "./manager.js";
interface SocketReservedEvents {
    connect: () => void;
    connect_error: (err: Error) => void;
    disconnect: (reason: Socket.DisconnectReason) => void;
}
export declare class Socket<ListenEvents extends EventsMap = DefaultEventsMap, EmitEvents extends EventsMap = ListenEvents> extends Emitter<ListenEvents, EmitEvents, SocketReservedEvents> {
    readonly io: Manager<ListenEvents, EmitEvents>;
    id: string;
    connected: boolean;
    disconnected: boolean;
    private receiveBuffer;
    private sendBuffer;
    private subs?;
    constructor(io: Manager<ListenEvents, EmitEvents>);
    connect(): this;
    emit<Ev extends EventNames<EmitEvents>>(event: Ev, ...args: EventParams<EmitEvents, Ev>): this;
    disconnect(): this;
    private subEvents;
    private packet;
    private onopen;
    private onerror;
    private onclose;
    private onpacket;
    private onevent;
    private onconnect;
    private emitBuffered;
    private ondisconnect;
    private destroy;
}
export declare namespace Socket {
    type DisconnectReason = "io server disconnect" | "io client disconnect" | "ping timeout" | "transport close" | "transport error" | "forced close";
}
export {};
