import { Emitter } from "@socket.io/component-emitter";
export const protocol = 5;
export var PacketType;
(function (PacketType) {
    PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
    PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
    PacketType[PacketType["EVENT"] = 2] = "EVENT";
    PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
})(PacketType || (PacketType = {}));
export class Encoder {
    encode(packet) {
        let encoded = String(packet.type);
        if (packet.data !== undefined) {
            encoded += JSON.stringify(packet.data);
        }
        return [encoded];
    }
}
export class Decoder extends Emitter {
    add(encoded) {
        if (typeof encoded !== "string") {
            throw new Error("Only Socket.IO text packets are supported");
        }
        super.emitReserved("decoded", this.decode(encoded));
    }
    destroy() { }
    decode(encoded) {
        const type = Number(encoded.charAt(0));
        if (type !== PacketType.CONNECT &&
            type !== PacketType.DISCONNECT &&
            type !== PacketType.EVENT &&
            type !== PacketType.CONNECT_ERROR) {
            throw new Error(`Unsupported Socket.IO packet type: ${type}`);
        }
        const payloadText = encoded.slice(1);
        const data = payloadText ? parsePayload(payloadText) : undefined;
        if (!Decoder.isPayloadValid(type, data)) {
            throw new Error("Invalid Socket.IO payload");
        }
        return {
            type,
            nsp: "/",
            data,
        };
    }
    static isPayloadValid(type, data) {
        switch (type) {
            case PacketType.CONNECT:
                return data === undefined || typeof data === "object";
            case PacketType.DISCONNECT:
                return data === undefined;
            case PacketType.EVENT:
                return Array.isArray(data) && data.length > 0;
            case PacketType.CONNECT_ERROR:
                return typeof data === "string" || typeof data === "object";
        }
    }
}
function parsePayload(payload) {
    try {
        return JSON.parse(payload);
    }
    catch (_a) {
        throw new Error("Invalid Socket.IO JSON payload");
    }
}
