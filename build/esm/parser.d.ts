import { Emitter } from "@socket.io/component-emitter";
/**
 * Protocol version.
 *
 * @public
 */
export declare const protocol: number;
export declare enum PacketType {
    CONNECT = 0,
    DISCONNECT = 1,
    EVENT = 2,
    ACK = 3,
    CONNECT_ERROR = 4,
    BINARY_EVENT = 5,
    BINARY_ACK = 6
}
export interface Packet {
    type: PacketType;
    nsp: string;
    data?: any;
    id?: number;
    attachments?: number;
}
/**
 * A socket.io Encoder instance
 */
export declare class Encoder {
    /**
     * Encode a packet as a single string if non-binary, or as a
     * buffer sequence, depending on packet type.
     *
     * @param {Object} obj - packet object
     */
    encode(obj: Packet): string[];
    /**
     * Encode packet as string.
     */
    private encodeAsString;
}
interface DecoderReservedEvents {
    decoded: (packet: Packet) => void;
}
/**
 * A socket.io Decoder instance
 *
 * @return {Object} decoder
 */
export declare class Decoder extends Emitter<{}, {}, DecoderReservedEvents> {
    constructor();
    /**
     * Decodes an encoded packet string into packet JSON.
     *
     * @param {String} obj - encoded packet
     */
    add(obj: any): void;
    /**
     * Decode a packet String (JSON data)
     *
     * @param {String} str
     * @return {Object} packet
     */
    private decodeString;
    private static isPayloadValid;
    /**
     * Deallocates a parser's resources
     */
    destroy(): void;
}
export {};
