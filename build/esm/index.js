import { Emitter } from "@socket.io/component-emitter";
import Backoff from "backo2";
//#region node_modules/engine.io-client/build/esm/parser.js
var PACKET_TYPES = {
	open: "0",
	close: "1",
	ping: "2",
	pong: "3",
	message: "4",
	upgrade: "5",
	noop: "6"
};
var PACKET_TYPES_REVERSE = Object.create(null);
Object.keys(PACKET_TYPES).forEach((type) => {
	PACKET_TYPES_REVERSE[PACKET_TYPES[type]] = type;
});
var ERROR_PACKET = {
	type: "error",
	data: "parser error"
};
function encodePacket(packet) {
	if (packet.data !== void 0 && typeof packet.data !== "string") throw new TypeError("Only Engine.IO text packets are supported");
	return PACKET_TYPES[packet.type] + (packet.data || "");
}
function decodePacket(encodedPacket) {
	if (typeof encodedPacket !== "string") return ERROR_PACKET;
	const type = PACKET_TYPES_REVERSE[encodedPacket.charAt(0)];
	if (!type) return ERROR_PACKET;
	return encodedPacket.length > 1 ? {
		type,
		data: encodedPacket.substring(1)
	} : { type };
}
//#endregion
//#region node_modules/engine.io-client/build/esm/globalThis.js
var globalThis_default = globalThis;
//#endregion
//#region node_modules/engine.io-client/build/esm/util.js
var NATIVE_SET_TIMEOUT = setTimeout;
var NATIVE_CLEAR_TIMEOUT = clearTimeout;
function installTimerFunctions(obj, opts) {
	if (opts.useNativeTimers) {
		obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThis_default);
		obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThis_default);
	} else {
		obj.setTimeoutFn = setTimeout.bind(globalThis_default);
		obj.clearTimeoutFn = clearTimeout.bind(globalThis_default);
	}
}
//#endregion
//#region node_modules/engine.io-client/build/esm/transport.js
var TransportError = class extends Error {
	constructor(reason, description, context) {
		super(reason);
		this.description = description;
		this.context = context;
		this.type = "TransportError";
	}
};
var Transport = class extends Emitter {
	/**
	* Transport abstract constructor.
	*
	* @param {Object} options.
	* @api private
	*/
	constructor(opts) {
		super();
		this.writable = false;
		installTimerFunctions(this, opts);
		this.opts = opts;
		this.query = opts.query;
		this.readyState = "";
	}
	/**
	* Emits an error.
	*
	* @param {String} reason
	* @param description
	* @param context - the error context
	* @return {Transport} for chaining
	* @api protected
	*/
	onError(reason, description, context) {
		super.emitReserved("error", new TransportError(reason, description, context));
		return this;
	}
	/**
	* Opens the transport.
	*
	* @api public
	*/
	open() {
		if ("closed" === this.readyState || "" === this.readyState) {
			this.readyState = "opening";
			this.doOpen();
		}
		return this;
	}
	/**
	* Closes the transport.
	*
	* @api public
	*/
	close() {
		if ("opening" === this.readyState || "open" === this.readyState) {
			this.doClose();
			this.onClose();
		}
		return this;
	}
	/**
	* Sends multiple packets.
	*
	* @param {Array} packets
	* @api public
	*/
	send(packets) {
		if ("open" === this.readyState) this.write(packets);
	}
	/**
	* Called upon open
	*
	* @api protected
	*/
	onOpen() {
		this.readyState = "open";
		this.writable = true;
		super.emitReserved("open");
	}
	/**
	* Called with data.
	*
	* @param {String} data
	* @api protected
	*/
	onData(data) {
		const packet = decodePacket(data);
		this.onPacket(packet);
	}
	/**
	* Called with a decoded packet.
	*
	* @api protected
	*/
	onPacket(packet) {
		super.emitReserved("packet", packet);
	}
	/**
	* Called upon close.
	*
	* @api protected
	*/
	onClose(details) {
		this.readyState = "closed";
		super.emitReserved("close", details);
	}
};
//#endregion
//#region node_modules/engine.io-client/build/esm/transports/websocket-constructor.js
var WebSocket = globalThis_default.WebSocket;
var nextTick = (callback) => Promise.resolve().then(callback);
//#endregion
//#region node_modules/engine.io-client/build/esm/transports/websocket.js
var WS = class extends Transport {
	/**
	* WebSocket transport constructor.
	*
	* @api {Object} connection options
	* @api public
	*/
	constructor(opts) {
		super(opts);
	}
	/**
	* Transport name.
	*
	* @api public
	*/
	get name() {
		return "websocket";
	}
	/**
	* Opens socket.
	*
	* @api private
	*/
	doOpen() {
		if (!this.check()) {
			this.onError("websocket unavailable", "WebSocket is not supported");
			return;
		}
		const uri = this.uri();
		try {
			this.ws = new WebSocket(uri);
		} catch (err) {
			return this.emitReserved("error", err);
		}
		this.addEventListeners();
	}
	/**
	* Adds event listeners to the socket
	*
	* @api private
	*/
	addEventListeners() {
		this.ws.onopen = () => {
			this.onOpen();
		};
		this.ws.onclose = (closeEvent) => this.onClose({
			description: "websocket connection closed",
			context: closeEvent
		});
		this.ws.onmessage = (ev) => this.onData(ev.data);
		this.ws.onerror = (e) => this.onError("websocket error", e);
	}
	/**
	* Writes data to socket.
	*
	* @param {Array} array of packets.
	* @api private
	*/
	write(packets) {
		this.writable = false;
		for (let i = 0; i < packets.length; i++) {
			const packet = packets[i];
			const lastPacket = i === packets.length - 1;
			const data = encodePacket(packet);
			try {
				this.ws.send(data);
			} catch (_a) {}
			if (lastPacket) nextTick(() => {
				this.writable = true;
				this.emitReserved("drain");
			});
		}
	}
	/**
	* Closes socket.
	*
	* @api private
	*/
	doClose() {
		if (typeof this.ws !== "undefined") {
			this.ws.close();
			this.ws = null;
		}
	}
	/**
	* Generates uri for connection.
	*
	* @api private
	*/
	uri() {
		const query = this.query || {};
		const schema = this.opts.secure ? "wss" : "ws";
		let port = "";
		if (this.opts.port && ("wss" === schema && Number(this.opts.port) !== 443 || "ws" === schema && Number(this.opts.port) !== 80)) port = ":" + this.opts.port;
		const encodedQuery = new URLSearchParams(query).toString();
		const ipv6 = this.opts.hostname.indexOf(":") !== -1;
		return schema + "://" + (ipv6 ? "[" + this.opts.hostname + "]" : this.opts.hostname) + port + this.opts.path + (encodedQuery.length ? "?" + encodedQuery : "");
	}
	/**
	* Feature detection for WebSocket.
	*
	* @return {Boolean} whether this transport is available.
	* @api public
	*/
	check() {
		return typeof WebSocket === "function";
	}
};
//#endregion
//#region node_modules/engine.io-client/build/esm/socket.js
function parseUrl(uri) {
	if (typeof URL === "function") return new URL(uri);
	const anchor = document.createElement("a");
	anchor.href = uri;
	return anchor;
}
var Socket$1 = class extends Emitter {
	constructor(uri, opts = {}) {
		super();
		this.readyState = "";
		this.writeBuffer = [];
		this.prevBufferLen = 0;
		if (uri && typeof uri === "object") {
			opts = uri;
			uri = void 0;
		}
		if (typeof uri === "string" && uri) {
			const parsedUri = parseUrl(uri);
			opts.hostname = parsedUri.hostname;
			opts.secure = parsedUri.protocol === "https:" || parsedUri.protocol === "wss:";
			opts.port = parsedUri.port;
			if (opts.hostname[0] === "[") opts.hostname = opts.hostname.slice(1, -1);
		}
		installTimerFunctions(this, opts);
		this.secure = opts.secure !== void 0 ? opts.secure : window.location.protocol === "https:";
		if (opts.hostname && !opts.port) opts.port = this.secure ? "443" : "80";
		this.hostname = opts.hostname || window.location.hostname;
		this.port = opts.port || (window.location.port ? window.location.port : this.secure ? "443" : "80");
		this.opts = Object.assign({
			path: "/engine.io",
			closeOnBeforeunload: true
		}, opts);
		this.opts.path = this.opts.path.replace(/\/$/, "") + "/";
		if (this.opts.closeOnBeforeunload) window.addEventListener("beforeunload", () => {
			if (this.transport) {
				this.transport.removeAllListeners();
				this.transport.close();
			}
		}, false);
		if (this.hostname !== "localhost") {
			this.offlineEventListener = () => {
				this.onClose("transport close", { description: "network connection lost" });
			};
			window.addEventListener("offline", this.offlineEventListener, false);
		}
		this.open();
	}
	createTransport() {
		const query = clone(this.opts.query);
		query.EIO = 4;
		query.transport = "websocket";
		if (this.id) query.sid = this.id;
		return new WS(Object.assign({}, this.opts, {
			query,
			hostname: this.hostname,
			secure: this.secure,
			port: this.port
		}));
	}
	open() {
		if (this.opts.transports && this.opts.transports.indexOf("websocket") === -1) {
			this.setTimeoutFn(() => {
				this.emitReserved("error", /* @__PURE__ */ new Error("WebSocket transport required"));
			}, 0);
			return;
		}
		this.readyState = "opening";
		const transport = this.createTransport();
		this.setTransport(transport);
		transport.open();
	}
	setTransport(transport) {
		if (this.transport) this.transport.removeAllListeners();
		this.transport = transport;
		transport.on("drain", this.onDrain.bind(this)).on("packet", this.onPacket.bind(this)).on("error", this.onError.bind(this)).on("close", (details) => this.onClose("transport close", details));
	}
	onPacket(packet) {
		if (this.readyState !== "opening" && this.readyState !== "open" && this.readyState !== "closing") return;
		switch (packet.type) {
			case "open":
				this.onHandshake(JSON.parse(packet.data));
				break;
			case "ping":
				this.resetPingTimeout();
				this.sendPacket("pong");
				this.emitReserved("ping");
				break;
			case "error": {
				const error = /* @__PURE__ */ new Error("server error");
				error.code = packet.data;
				this.onError(error);
				break;
			}
			case "message": this.emitReserved("data", packet.data);
		}
	}
	onHandshake(data) {
		this.id = data.sid;
		this.transport.query.sid = data.sid;
		this.pingInterval = data.pingInterval;
		this.pingTimeout = data.pingTimeout;
		this.readyState = "open";
		this.emitReserved("open");
		this.flush();
		if (this.readyState === "open") this.resetPingTimeout();
	}
	resetPingTimeout() {
		this.clearTimeoutFn(this.pingTimeoutTimer);
		this.pingTimeoutTimer = this.setTimeoutFn(() => {
			this.onClose("ping timeout");
		}, this.pingInterval + this.pingTimeout);
	}
	onDrain() {
		this.writeBuffer.splice(0, this.prevBufferLen);
		this.prevBufferLen = 0;
		if (this.writeBuffer.length === 0) this.emitReserved("drain");
		else this.flush();
	}
	flush() {
		if (this.readyState !== "closed" && this.transport.writable && this.writeBuffer.length) {
			this.transport.send(this.writeBuffer);
			this.prevBufferLen = this.writeBuffer.length;
			this.emitReserved("flush");
		}
	}
	write(message, options, callback) {
		this.sendPacket("message", message, options, callback);
		return this;
	}
	sendPacket(type, data, options, callback) {
		if (typeof data === "function") {
			callback = data;
			data = void 0;
		}
		if (typeof options === "function") {
			callback = options;
			options = void 0;
		}
		if (this.readyState === "closing" || this.readyState === "closed") return;
		this.writeBuffer.push({
			type,
			data,
			options: options || {}
		});
		if (callback) this.once("flush", callback);
		this.flush();
	}
	close() {
		if (this.readyState !== "opening" && this.readyState !== "open") return this;
		this.readyState = "closing";
		if (this.writeBuffer.length) this.once("drain", () => this.onClose("forced close"));
		else this.onClose("forced close");
		return this;
	}
	onError(error) {
		this.emitReserved("error", error);
		this.onClose("transport error", error);
	}
	onClose(reason, description) {
		if (this.readyState !== "opening" && this.readyState !== "open" && this.readyState !== "closing") return;
		this.clearTimeoutFn(this.pingTimeoutTimer);
		if (this.transport) {
			this.transport.removeAllListeners("close");
			this.transport.close();
			this.transport.removeAllListeners();
		}
		if (this.offlineEventListener) window.removeEventListener("offline", this.offlineEventListener, false);
		this.readyState = "closed";
		this.id = null;
		this.emitReserved("close", reason, description);
		this.writeBuffer = [];
		this.prevBufferLen = 0;
	}
};
function clone(query) {
	return query && typeof query === "object" ? Object.assign({}, query) : {};
}
//#endregion
//#region lib/on.ts
function on(obj, ev, fn) {
	obj.on(ev, fn);
	return function subDestroy() {
		obj.off(ev, fn);
	};
}
//#endregion
//#region lib/parser.ts
var PacketType = /* @__PURE__ */ function(PacketType) {
	PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
	PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
	PacketType[PacketType["EVENT"] = 2] = "EVENT";
	PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
	return PacketType;
}({});
var Encoder = class {
	encode(packet) {
		let encoded = String(packet.type);
		if (packet.data !== void 0) encoded += JSON.stringify(packet.data);
		return [encoded];
	}
};
var Decoder = class Decoder extends Emitter {
	add(encoded) {
		if (typeof encoded !== "string") throw new Error("Only Socket.IO text packets are supported");
		super.emitReserved("decoded", this.decode(encoded));
	}
	destroy() {}
	decode(encoded) {
		const type = Number(encoded.charAt(0));
		if (type !== 0 && type !== 1 && type !== 2 && type !== 4) throw new Error(`Unsupported Socket.IO packet type: ${type}`);
		const payloadText = encoded.slice(1);
		const data = payloadText ? parsePayload(payloadText) : void 0;
		if (!Decoder.isPayloadValid(type, data)) throw new Error("Invalid Socket.IO payload");
		return {
			type,
			nsp: "/",
			data
		};
	}
	static isPayloadValid(type, data) {
		switch (type) {
			case 0: return data === void 0 || typeof data === "object";
			case 1: return data === void 0;
			case 2: return Array.isArray(data) && data.length > 0;
			case 4: return typeof data === "string" || typeof data === "object";
		}
	}
};
function parsePayload(payload) {
	try {
		return JSON.parse(payload);
	} catch (_unused) {
		throw new Error("Invalid Socket.IO JSON payload");
	}
}
//#endregion
//#region lib/socket.ts
var RESERVED_EVENTS = Object.freeze({
	connect: 1,
	connect_error: 1,
	disconnect: 1
});
var Socket = class extends Emitter {
	constructor(io) {
		super();
		this.connected = false;
		this.disconnected = true;
		this.receiveBuffer = [];
		this.sendBuffer = [];
		this.io = io;
		if (this.io._autoConnect) this.connect();
	}
	connect() {
		if (this.connected) return this;
		this.subEvents();
		if (!this.io._reconnecting) this.io.open();
		if (this.io._readyState === "open") this.onopen();
		return this;
	}
	emit(event, ...args) {
		if (RESERVED_EVENTS.hasOwnProperty(event)) throw new Error(`"${String(event)}" is a reserved event name`);
		const packet = {
			type: PacketType.EVENT,
			nsp: "/",
			data: [event, ...args]
		};
		if (this.connected) this.packet(packet);
		else this.sendBuffer.push(packet);
		return this;
	}
	disconnect() {
		if (this.connected) this.packet({
			type: PacketType.DISCONNECT,
			nsp: "/"
		});
		this.destroy();
		if (this.connected) this.onclose("io client disconnect");
		return this;
	}
	subEvents() {
		if (this.subs) return;
		this.subs = [
			on(this.io, "open", this.onopen.bind(this)),
			on(this.io, "packet", this.onpacket.bind(this)),
			on(this.io, "error", this.onerror.bind(this)),
			on(this.io, "close", this.onclose.bind(this))
		];
	}
	packet(packet) {
		this.io._packet(packet);
	}
	onopen() {
		this.packet({
			type: PacketType.CONNECT,
			nsp: "/"
		});
	}
	onerror(err) {
		if (!this.connected) this.emitReserved("connect_error", err);
	}
	onclose(reason) {
		this.connected = false;
		this.disconnected = true;
		delete this.id;
		this.emitReserved("disconnect", reason);
	}
	onpacket(packet) {
		if (packet.nsp !== "/") return;
		switch (packet.type) {
			case PacketType.CONNECT:
				var _packet$data;
				if ((_packet$data = packet.data) === null || _packet$data === void 0 ? void 0 : _packet$data.sid) this.onconnect(packet.data.sid);
				else this.emitReserved("connect_error", /* @__PURE__ */ new Error("Invalid Socket.IO handshake"));
				break;
			case PacketType.EVENT:
				this.onevent(packet);
				break;
			case PacketType.DISCONNECT:
				this.ondisconnect();
				break;
			case PacketType.CONNECT_ERROR: {
				var _packet$data2, _packet$data3;
				this.destroy();
				const error = new Error(typeof packet.data === "string" ? packet.data : ((_packet$data2 = packet.data) === null || _packet$data2 === void 0 ? void 0 : _packet$data2.message) || "Socket.IO connection error");
				error.data = (_packet$data3 = packet.data) === null || _packet$data3 === void 0 ? void 0 : _packet$data3.data;
				this.emitReserved("connect_error", error);
				break;
			}
		}
	}
	onevent(packet) {
		const args = packet.data || [];
		if (this.connected) super.emit.apply(this, args);
		else this.receiveBuffer.push(Object.freeze(args));
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
			this.subs = void 0;
		}
		this.io._destroy(this);
	}
};
//#endregion
//#region lib/manager.ts
var Manager = class extends Emitter {
	constructor(uri, opts = {}) {
		var _opts$reconnectionAtt, _opts$timeout, _opts$reconnectionDel, _opts$reconnectionDel2, _opts$randomizationFa;
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
		this.reconnectionAttemptsLimit = (_opts$reconnectionAtt = opts.reconnectionAttempts) !== null && _opts$reconnectionAtt !== void 0 ? _opts$reconnectionAtt : Infinity;
		this.timeoutValue = (_opts$timeout = opts.timeout) !== null && _opts$timeout !== void 0 ? _opts$timeout : 2e4;
		this.backoff = new Backoff({
			min: (_opts$reconnectionDel = opts.reconnectionDelay) !== null && _opts$reconnectionDel !== void 0 ? _opts$reconnectionDel : 1e3,
			max: (_opts$reconnectionDel2 = opts.reconnectionDelayMax) !== null && _opts$reconnectionDel2 !== void 0 ? _opts$reconnectionDel2 : 5e3,
			jitter: (_opts$randomizationFa = opts.randomizationFactor) !== null && _opts$randomizationFa !== void 0 ? _opts$randomizationFa : .5
		});
		this._autoConnect = opts.autoConnect !== false;
		installTimerFunctions(this, opts);
		if (this._autoConnect) this.open();
	}
	open(callback) {
		if (this._readyState === "opening" || this._readyState === "open") return this;
		this.engine = new Socket$1(this.uri, this.opts);
		const engine = this.engine;
		this._readyState = "opening";
		this.skipReconnect = false;
		const removeOpenListener = on(engine, "open", () => {
			this.onopen();
			callback === null || callback === void 0 || callback();
		});
		const removeErrorListener = on(engine, "error", (err) => {
			this.cleanup();
			this._readyState = "closed";
			this.emitReserved("error", err);
			if (callback) callback(err);
			else this.maybeReconnectOnOpen();
		});
		this.subs.push(removeOpenListener, removeErrorListener);
		if (this.timeoutValue !== false) {
			const timer = this.setTimeoutFn(() => {
				removeOpenListener();
				engine.close();
				engine.emit("error", /* @__PURE__ */ new Error("timeout"));
			}, this.timeoutValue);
			this.subs.push(() => this.clearTimeoutFn(timer));
		}
		return this;
	}
	socket() {
		if (!this.socketInstance) this.socketInstance = new Socket(this);
		return this.socketInstance;
	}
	_destroy(socket) {
		if (socket === this.socketInstance) this._close();
	}
	_packet(packet) {
		for (const encodedPacket of this.encoder.encode(packet)) this.engine.write(encodedPacket);
	}
	_close() {
		this.skipReconnect = true;
		this._reconnecting = false;
		this.onclose("forced close");
		if (this.engine) this.engine.close();
	}
	maybeReconnectOnOpen() {
		if (!this._reconnecting && this.reconnectionEnabled && this.backoff.attempts === 0) this.reconnect();
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
		if (this.reconnectionEnabled && !this.skipReconnect) this.reconnect();
	}
	reconnect() {
		if (this._reconnecting || this.skipReconnect) return this;
		if (this.backoff.attempts >= this.reconnectionAttemptsLimit) {
			this.backoff.reset();
			this._reconnecting = false;
			this.emitReserved("reconnect_failed");
			return;
		}
		const delay = this.backoff.duration();
		this._reconnecting = true;
		const timer = this.setTimeoutFn(() => {
			if (this.skipReconnect) return;
			this.emitReserved("reconnect_attempt", this.backoff.attempts);
			if (this.skipReconnect) return;
			this.open((err) => {
				if (err) {
					this._reconnecting = false;
					this.emitReserved("reconnect_error", err);
					this.reconnect();
				} else this.onreconnect();
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
};
//#endregion
//#region lib/index.ts
function io(uri, opts = {}) {
	if (!/^(https?|wss?):\/\//.test(uri)) throw new Error("An absolute Socket.IO URL is required");
	return new Manager(uri, opts).socket();
}
//#endregion
export { Socket, io as default, io };
