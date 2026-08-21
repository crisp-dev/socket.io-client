// @ts-ignore
import { Socket as Engine, installTimerFunctions, } from "engine.io-client";
import Backoff from "backo2";
import { Emitter, } from "@socket.io/component-emitter";
import { on } from "./on.js";
import { Decoder, Encoder } from "./parser.js";
import { Socket } from "./socket.js";
export class Manager extends Emitter {
    constructor(uri, opts = {}) {
        var _a, _b, _c, _d, _e;
        super();
        this._readyState = "closed";
        this._reconnecting = false;
        this.subs = [];
        this.skipReconnect = false;
        this.encoder = new Encoder();
        this.decoder = new Decoder();
        opts.path = opts.path || "/socket.io";
        this.uri = uri;
        this.opts = opts;
        this.reconnectionEnabled = opts.reconnection !== false;
        this.reconnectionAttemptsLimit = (_a = opts.reconnectionAttempts) !== null && _a !== void 0 ? _a : Infinity;
        this.timeoutValue = (_b = opts.timeout) !== null && _b !== void 0 ? _b : 20000;
        this.backoff = new Backoff({
            min: (_c = opts.reconnectionDelay) !== null && _c !== void 0 ? _c : 1000,
            max: (_d = opts.reconnectionDelayMax) !== null && _d !== void 0 ? _d : 5000,
            jitter: (_e = opts.randomizationFactor) !== null && _e !== void 0 ? _e : 0.5,
        });
        this._autoConnect = opts.autoConnect !== false;
        installTimerFunctions(this, opts);
        if (this._autoConnect) {
            this.open();
        }
    }
    open(callback) {
        if (this._readyState === "opening" || this._readyState === "open") {
            return this;
        }
        this.engine = new Engine(this.uri, this.opts);
        const engine = this.engine;
        this._readyState = "opening";
        this.skipReconnect = false;
        const removeOpenListener = on(engine, "open", () => {
            this.onopen();
            callback === null || callback === void 0 ? void 0 : callback();
        });
        const removeErrorListener = on(engine, "error", (err) => {
            this.cleanup();
            this._readyState = "closed";
            this.emitReserved("error", err);
            if (callback) {
                callback(err);
            }
            else {
                this.maybeReconnectOnOpen();
            }
        });
        this.subs.push(removeOpenListener, removeErrorListener);
        if (this.timeoutValue !== false) {
            const timer = this.setTimeoutFn(() => {
                removeOpenListener();
                engine.close();
                engine.emit("error", new Error("timeout"));
            }, this.timeoutValue);
            this.subs.push(() => this.clearTimeoutFn(timer));
        }
        return this;
    }
    socket() {
        if (!this.socketInstance) {
            this.socketInstance = new Socket(this);
        }
        return this.socketInstance;
    }
    _destroy(socket) {
        if (socket === this.socketInstance) {
            this._close();
        }
    }
    _packet(packet) {
        for (const encodedPacket of this.encoder.encode(packet)) {
            this.engine.write(encodedPacket);
        }
    }
    _close() {
        this.skipReconnect = true;
        this._reconnecting = false;
        this.onclose("forced close");
        if (this.engine) {
            this.engine.close();
        }
    }
    maybeReconnectOnOpen() {
        if (!this._reconnecting &&
            this.reconnectionEnabled &&
            this.backoff.attempts === 0) {
            this.reconnect();
        }
    }
    onopen() {
        this.cleanup();
        this._readyState = "open";
        this.emitReserved("open");
        this.subs.push(on(this.engine, "ping", () => this.emitReserved("ping")), on(this.engine, "data", (data) => this.decoder.add(data)), on(this.engine, "error", (err) => this.emitReserved("error", err)), on(this.engine, "close", (reason) => this.onclose(reason)), on(this.decoder, "decoded", (packet) => this.emitReserved("packet", packet)));
    }
    cleanup() {
        this.subs.forEach((removeSubscription) => removeSubscription());
        this.subs.length = 0;
        this.decoder.destroy();
    }
    onclose(reason) {
        this.cleanup();
        this.backoff.reset();
        this._readyState = "closed";
        this.emitReserved("close", reason);
        if (this.reconnectionEnabled && !this.skipReconnect) {
            this.reconnect();
        }
    }
    reconnect() {
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
                }
                else {
                    this.onreconnect();
                }
            });
        }, delay);
        this.subs.push(() => this.clearTimeoutFn(timer));
    }
    onreconnect() {
        const attempt = this.backoff.attempts;
        this._reconnecting = false;
        this.backoff.reset();
        this.emitReserved("reconnect", attempt);
    }
}
