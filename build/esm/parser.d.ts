import { Emitter } from "@socket.io/component-emitter";
export declare const protocol = 5;
export declare enum PacketType {
    CONNECT = 0,
    DISCONNECT = 1,
    EVENT = 2,
    CONNECT_ERROR = 4
}
export interface Packet {
    type: PacketType;
    nsp: "/";
    data?: any;
}
export declare class Encoder {
    encode(packet: Packet): string[];
}
interface DecoderReservedEvents {
    decoded: (packet: Packet) => void;
}
export declare class Decoder extends Emitter<{}, {}, DecoderReservedEvents> {
    add(encoded: string): void;
    destroy(): void;
    private decode;
    private static isPayloadValid;
}
export {};
