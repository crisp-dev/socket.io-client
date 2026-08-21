// @ts-ignore
import {
  Socket as Engine,
  SocketOptions as EngineOptions,
  installTimerFunctions,
} from "engine.io-client";
import Backoff from "backo2";
import {
  DefaultEventsMap,
  EventsMap,
  Emitter,
} from "@socket.io/component-emitter";
import { on } from "./on.js";
import { Decoder, Encoder, Packet } from "./parser.js";
import { Socket } from "./socket.js";

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

export class Manager<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents,
> extends Emitter<{}, {}, ManagerReservedEvents> {
  public engine: Engine;
  public uri: string;
  public opts: Partial<ManagerOptions>;
  public _autoConnect: boolean;
  public _readyState: "opening" | "open" | "closed" = "closed";
  public _reconnecting = false;

  private socketInstance: Socket<ListenEvents, EmitEvents>;
  private subs: Array<ReturnType<typeof on>> = [];
  private backoff: Backoff;
  private setTimeoutFn: typeof setTimeout;
  private clearTimeoutFn: typeof clearTimeout;
  private reconnectionEnabled: boolean;
  private reconnectionAttemptsLimit: number;
  private timeoutValue: number | boolean;
  private skipReconnect = false;
  private encoder = new Encoder();
  private decoder = new Decoder();

  constructor(uri: string, opts: Partial<ManagerOptions> = {}) {
    super();

    opts.path = opts.path || "/socket.io";
    this.uri = uri;
    this.opts = opts;
    this.reconnectionEnabled = opts.reconnection !== false;
    this.reconnectionAttemptsLimit = opts.reconnectionAttempts ?? Infinity;
    this.timeoutValue = opts.timeout ?? 20000;
    this.backoff = new Backoff({
      min: opts.reconnectionDelay ?? 1000,
      max: opts.reconnectionDelayMax ?? 5000,
      jitter: opts.randomizationFactor ?? 0.5,
    });
    this._autoConnect = opts.autoConnect !== false;

    installTimerFunctions(this, opts);

    if (this._autoConnect) {
      this.open();
    }
  }

  public open(callback?: (err?: Error) => void): this {
    if (this._readyState === "opening" || this._readyState === "open") {
      return this;
    }

    this.engine = new Engine(this.uri, this.opts);
    const engine = this.engine;
    this._readyState = "opening";
    this.skipReconnect = false;

    const removeOpenListener = on(engine, "open", () => {
      this.onopen();
      callback?.();
    });

    const removeErrorListener = on(engine, "error", (err) => {
      this.cleanup();
      this._readyState = "closed";
      this.emitReserved("error", err);

      if (callback) {
        callback(err);
      } else {
        this.maybeReconnectOnOpen();
      }
    });

    this.subs.push(removeOpenListener, removeErrorListener);

    if (this.timeoutValue !== false) {
      const timer = this.setTimeoutFn(() => {
        removeOpenListener();
        engine.close();
        (engine as any).emit("error", new Error("timeout"));
      }, this.timeoutValue as number);

      this.subs.push(() => this.clearTimeoutFn(timer));
    }

    return this;
  }

  public socket(): Socket<ListenEvents, EmitEvents> {
    if (!this.socketInstance) {
      this.socketInstance = new Socket(this);
    }

    return this.socketInstance;
  }

  public _destroy(socket: Socket): void {
    if (socket === this.socketInstance) {
      this._close();
    }
  }

  public _packet(packet: Packet): void {
    for (const encodedPacket of this.encoder.encode(packet)) {
      this.engine.write(encodedPacket);
    }
  }

  public _close(): void {
    this.skipReconnect = true;
    this._reconnecting = false;
    this.onclose("forced close");

    if (this.engine) {
      this.engine.close();
    }
  }

  private maybeReconnectOnOpen(): void {
    if (
      !this._reconnecting &&
      this.reconnectionEnabled &&
      this.backoff.attempts === 0
    ) {
      this.reconnect();
    }
  }

  private onopen(): void {
    this.cleanup();
    this._readyState = "open";
    this.emitReserved("open");

    this.subs.push(
      on(this.engine, "ping", () => this.emitReserved("ping")),
      on(this.engine, "data", (data) => this.decoder.add(data)),
      on(this.engine, "error", (err) => this.emitReserved("error", err)),
      on(this.engine, "close", (reason) => this.onclose(reason)),
      on(this.decoder, "decoded", (packet) =>
        this.emitReserved("packet", packet),
      ),
    );
  }

  private cleanup(): void {
    this.subs.forEach((removeSubscription) => removeSubscription());
    this.subs.length = 0;
    this.decoder.destroy();
  }

  private onclose(reason: string): void {
    this.cleanup();
    this.backoff.reset();
    this._readyState = "closed";
    this.emitReserved("close", reason);

    if (this.reconnectionEnabled && !this.skipReconnect) {
      this.reconnect();
    }
  }

  private reconnect(): this | void {
    if (this._reconnecting || this.skipReconnect) {
      return this;
    }

    if (this.backoff.attempts >= this.reconnectionAttemptsLimit) {
      this.backoff.reset();
      this._reconnecting = false;
      this.emitReserved("reconnect_failed");
      return;
    }

    const delay = this.backoff.duration();
    this._reconnecting = true;

    const timer = this.setTimeoutFn(() => {
      if (this.skipReconnect) {
        return;
      }

      this.emitReserved("reconnect_attempt", this.backoff.attempts);

      if (this.skipReconnect) {
        return;
      }

      this.open((err) => {
        if (err) {
          this._reconnecting = false;
          this.emitReserved("reconnect_error", err);
          this.reconnect();
        } else {
          this.onreconnect();
        }
      });
    }, delay);

    this.subs.push(() => this.clearTimeoutFn(timer));
  }

  private onreconnect(): void {
    const attempt = this.backoff.attempts;
    this._reconnecting = false;
    this.backoff.reset();
    this.emitReserved("reconnect", attempt);
  }
}
