import { Emitter, } from "@socket.io/component-emitter";
import { on } from "./on.js";
import { PacketType } from "./parser.js";
const RESERVED_EVENTS = Object.freeze({
    connect: 1,
    connect_error: 1,
    disconnect: 1,
});
export class Socket extends Emitter {
    constructor(io) {
        super();
        this.connected = false;
        this.disconnected = true;
        this.receiveBuffer = [];
        this.sendBuffer = [];
        this.io = io;
        if (this.io._autoConnect) {
            this.connect();
        }
    }
    connect() {
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
    emit(event, ...args) {
        if (RESERVED_EVENTS.hasOwnProperty(event)) {
            throw new Error(`"${String(event)}" is a reserved event name`);
        }
        const packet = {
            type: PacketType.EVENT,
            nsp: "/",
            data: [event, ...args],
        };
        if (this.connected) {
            this.packet(packet);
        }
        else {
            this.sendBuffer.push(packet);
        }
        return this;
    }
    disconnect() {
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
    subEvents() {
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
    packet(packet) {
        this.io._packet(packet);
    }
    onopen() {
        this.packet({
            type: PacketType.CONNECT,
            nsp: "/",
        });
    }
    onerror(err) {
        if (!this.connected) {
            this.emitReserved("connect_error", err);
        }
    }
    onclose(reason) {
        this.connected = false;
        this.disconnected = true;
        delete this.id;
        this.emitReserved("disconnect", reason);
    }
    onpacket(packet) {
        var _a, _b, _c;
        if (packet.nsp !== "/") {
            return;
        }
        switch (packet.type) {
            case PacketType.CONNECT:
                if ((_a = packet.data) === null || _a === void 0 ? void 0 : _a.sid) {
                    this.onconnect(packet.data.sid);
                }
                else {
                    this.emitReserved("connect_error", new Error("Invalid Socket.IO handshake"));
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
                const error = new Error(typeof packet.data === "string"
                    ? packet.data
                    : ((_b = packet.data) === null || _b === void 0 ? void 0 : _b.message) || "Socket.IO connection error");
                error.data = (_c = packet.data) === null || _c === void 0 ? void 0 : _c.data;
                this.emitReserved("connect_error", error);
                break;
            }
        }
    }
    onevent(packet) {
        const args = packet.data || [];
        if (this.connected) {
            super.emit.apply(this, args);
        }
        else {
            this.receiveBuffer.push(Object.freeze(args));
        }
    }
    onconnect(id) {
        this.id = id;
        this.connected = true;
        this.disconnected = false;
        this.emitBuffered();
        this.emitReserved("connect");
    }
    emitBuffered() {
        this.receiveBuffer.forEach((args) => super.emit.apply(this, args));
        this.receiveBuffer = [];
        this.sendBuffer.forEach((packet) => this.packet(packet));
        this.sendBuffer = [];
    }
    ondisconnect() {
        this.destroy();
        this.onclose("io server disconnect");
    }
    destroy() {
        if (this.subs) {
            this.subs.forEach((removeSubscription) => removeSubscription());
            this.subs = undefined;
        }
        this.io._destroy(this);
    }
}
