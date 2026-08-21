import { Emitter } from "@socket.io/component-emitter";

export const protocol = 5;

export enum PacketType {
  CONNECT = 0,
  DISCONNECT = 1,
  EVENT = 2,
  CONNECT_ERROR = 4,
}

export interface Packet {
  type: PacketType;
  nsp: "/";
  data?: any;
}

export class Encoder {
  public encode(packet: Packet): string[] {
    let encoded = String(packet.type);

    if (packet.data !== undefined) {
      encoded += JSON.stringify(packet.data);
    }

    return [encoded];
  }
}

interface DecoderReservedEvents {
  decoded: (packet: Packet) => void;
}

export class Decoder extends Emitter<{}, {}, DecoderReservedEvents> {
  public add(encoded: string): void {
    if (typeof encoded !== "string") {
      throw new Error("Only Socket.IO text packets are supported");
    }

    super.emitReserved("decoded", this.decode(encoded));
  }

  public destroy(): void {}

  private decode(encoded: string): Packet {
    const type = Number(encoded.charAt(0)) as PacketType;

    if (
      type !== PacketType.CONNECT &&
      type !== PacketType.DISCONNECT &&
      type !== PacketType.EVENT &&
      type !== PacketType.CONNECT_ERROR
    ) {
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

  private static isPayloadValid(type: PacketType, data: any): boolean {
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

function parsePayload(payload: string): any {
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error("Invalid Socket.IO JSON payload");
  }
}
