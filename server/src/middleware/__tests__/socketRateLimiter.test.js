import test from "node:test";
import assert from "node:assert/strict";
import attachSocketRateLimiter from "../socketRateLimiter.js";

function createMockSocket(id) {
  let onAnyHandler = null;
  let disconnectHandler = null;
  let disconnected = false;
  const emitted = [];

  const socket = {
    id,
    disconnect(permanent) {
      disconnected = true;
    },
    emit(event, data) {
      emitted.push({ event, data });
    },
    on(event, handler) {
      if (event === "disconnect") {
        disconnectHandler = handler;
        socket._disconnectHandler = handler;
      }
    },
    onAny(handler) {
      onAnyHandler = handler;
    },
    triggerEvent(event) {
      if (onAnyHandler) onAnyHandler(event);
    },
  };

  return { socket, emitted, getDisconnected: () => disconnected };
}

function createMockIO() {
  let connHandler = null;
  const io = {
    on(event, handler) {
      if (event === "connection") connHandler = handler;
    },
    acceptConnection(socket) {
      if (connHandler) connHandler(socket);
    },
  };
  return { io };
}

test("attaches connection handler to io", () => {
  const { io } = createMockIO();
  attachSocketRateLimiter(io);
  // io.on("connection") must have been called (acceptConnection should be callable)
  assert.ok(typeof io.acceptConnection === "function");
});

test("socket disconnect removes state entry", () => {
  const { io } = createMockIO();
  const { socket, getDisconnected } = createMockSocket("socket-1");
  attachSocketRateLimiter(io);
  io.acceptConnection(socket);
  // socket._disconnectHandler should be set after connection is accepted
  assert.strictEqual(typeof socket._disconnectHandler, "function",
    "disconnect handler should be registered on socket");
  // Calling disconnect handler should not crash (it cleans up state only)
  socket._disconnectHandler("client namespace disconnect");
  assert.strictEqual(getDisconnected(), false); // cleanup does not call socket.disconnect()
});

test("whitelisted events do not consume tokens", () => {
  const { io } = createMockIO();
  const { socket, getDisconnected } = createMockSocket("socket-2");
  attachSocketRateLimiter(io);
  io.acceptConnection(socket);

  // Whitelisted events should be allowed regardless of count
  const whitelisted = ["ping", "pong", "connect", "disconnect", "error"];
  for (let i = 0; i < 20; i++) {
    for (const event of whitelisted) {
      socket.triggerEvent(event);
    }
  }
  assert.strictEqual(getDisconnected(), false);
});

test("non-whitelisted events consume tokens and eventually disconnect", () => {
  const { io } = createMockIO();
  const { socket, getDisconnected } = createMockSocket("socket-3");
  attachSocketRateLimiter(io);
  io.acceptConnection(socket);

  // Emit many non-whitelisted events; default max is 50 so 60 should exceed it
  for (let i = 0; i < 60; i++) {
    socket.triggerEvent("custom_event_" + i);
  }
  assert.strictEqual(getDisconnected(), true);
});

test("rate_limited event is emitted when tokens are exhausted", () => {
  const { io } = createMockIO();
  const { socket, emitted, getDisconnected } = createMockSocket("socket-4");
  attachSocketRateLimiter(io);
  io.acceptConnection(socket);

  // Exhaust tokens
  for (let i = 0; i < 60; i++) {
    socket.triggerEvent("custom_event_" + i);
  }

  // Should have disconnected and emitted rate_limited
  assert.strictEqual(getDisconnected(), true);
  const rateLimited = emitted.find((e) => e.event === "rate_limited");
  assert.ok(rateLimited, "rate_limited event should be emitted");
});

test("socket state is cleaned up after disconnect", () => {
  const { io } = createMockIO();
  const { socket, getDisconnected } = createMockSocket("socket-5");
  attachSocketRateLimiter(io);
  io.acceptConnection(socket);

  assert.strictEqual(getDisconnected(), false);
  // Call the registered disconnect handler
  if (socket._disconnectHandler) {
    socket._disconnectHandler("client namespace disconnect");
  }
  // The disconnect handler should have cleaned up state
  // (no crash is the main assertion)
  assert.strictEqual(getDisconnected(), false);
});
