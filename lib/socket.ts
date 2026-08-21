import {
  DefaultEventsMap,
  EventNames,
  EventParams,
  EventsMap,
  Emitter,
} from "@socket.io/component-emitter";
import { Manager } from "./manager.js";
import { on } from "./on.js";
import { Packet, PacketType } from "./parser.js";

const RESERVED_EVENTS = Object.freeze({
  connect: 1,
  connect_error: 1,
  disconnect: 1,
});

interface SocketReservedEvents {
  connect: () => void;
  connect_error: (err: Error) => void;
  disconnect: (reason: Socket.DisconnectReason) => void;
}

export class Socket<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents,
> extends Emitter<ListenEvents, EmitEvents, SocketReservedEvents> {
  public readonly io: Manager<ListenEvents, EmitEvents>;
  public id: string;
  public connected = false;
  public disconnected = true;

  private receiveBuffer: Array<ReadonlyArray<any>> = [];
  private sendBuffer: Array<Packet> = [];
  private subs?: Array<VoidFunction>;

  constructor(io: Manager<ListenEvents, EmitEvents>) {
    super();
    this.io = io;

    if (this.io._autoConnect) {
      this.connect();
    }
  }

  public connect(): this {
    if (this.connected) {
      return this;
    }

    this.subEvents();

    if (!this.io._reconnecting) {
      this.io.open();
    }

    if (this.io._readyState === "open") {
      this.onopen();
    }

    return this;
  }

  public emit<Ev extends EventNames<EmitEvents>>(
    event: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): this {
    if (RESERVED_EVENTS.hasOwnProperty(event)) {
      throw new Error(`"${String(event)}" is a reserved event name`);
    }

    const packet: Packet = {
      type: PacketType.EVENT,
      nsp: "/",
      data: [event, ...args],
    };

    if (this.connected) {
      this.packet(packet);
    } else {
      this.sendBuffer.push(packet);
    }

    return this;
  }

  public disconnect(): this {
    if (this.connected) {
      this.packet({
        type: PacketType.DISCONNECT,
        nsp: "/",
      });
    }

    this.destroy();

    if (this.connected) {
      this.onclose("io client disconnect");
    }

    return this;
  }

  private subEvents(): void {
    if (this.subs) {
      return;
    }

    this.subs = [
      on(this.io, "open", this.onopen.bind(this)),
      on(this.io, "packet", this.onpacket.bind(this)),
      on(this.io, "error", this.onerror.bind(this)),
      on(this.io, "close", this.onclose.bind(this)),
    ];
  }

  private packet(packet: Packet): void {
    this.io._packet(packet);
  }

  private onopen(): void {
    this.packet({
      type: PacketType.CONNECT,
      nsp: "/",
    });
  }

  private onerror(err: Error): void {
    if (!this.connected) {
      this.emitReserved("connect_error", err);
    }
  }

  private onclose(reason: Socket.DisconnectReason): void {
    this.connected = false;
    this.disconnected = true;
    delete this.id;
    this.emitReserved("disconnect", reason);
  }

  private onpacket(packet: Packet): void {
    if (packet.nsp !== "/") {
      return;
    }

    switch (packet.type) {
      case PacketType.CONNECT:
        if (packet.data?.sid) {
          this.onconnect(packet.data.sid);
        } else {
          this.emitReserved(
            "connect_error",
            new Error("Invalid Socket.IO handshake"),
          );
        }
        break;

      case PacketType.EVENT:
        this.onevent(packet);
        break;

      case PacketType.DISCONNECT:
        this.ondisconnect();
        break;

      case PacketType.CONNECT_ERROR: {
        this.destroy();
        const error = new Error(
          typeof packet.data === "string"
            ? packet.data
            : packet.data?.message || "Socket.IO connection error",
        );
        (error as any).data = packet.data?.data;
        this.emitReserved("connect_error", error);
        break;
      }
    }
  }

  private onevent(packet: Packet): void {
    const args: ReadonlyArray<any> = packet.data || [];

    if (this.connected) {
      super.emit.apply(this, args);
    } else {
      this.receiveBuffer.push(Object.freeze(args));
    }
  }

  private onconnect(id: string): void {
    this.id = id;
    this.connected = true;
    this.disconnected = false;
    this.emitBuffered();
    this.emitReserved("connect");
  }

  private emitBuffered(): void {
    this.receiveBuffer.forEach((args) => super.emit.apply(this, args));
    this.receiveBuffer = [];

    this.sendBuffer.forEach((packet) => this.packet(packet));
    this.sendBuffer = [];
  }

  private ondisconnect(): void {
    this.destroy();
    this.onclose("io server disconnect");
  }

  private destroy(): void {
    if (this.subs) {
      this.subs.forEach((removeSubscription) => removeSubscription());
      this.subs = undefined;
    }

    this.io._destroy(this);
  }
}

export namespace Socket {
  export type DisconnectReason =
    | "io server disconnect"
    | "io client disconnect"
    | "ping timeout"
    | "transport close"
    | "transport error"
    | "forced close";
}
