const UPSTREAM_HTTP = "https://sopranochat-98mbbgjv.livekit.cloud";
const UPSTREAM_WS = "wss://sopranochat-98mbbgjv.livekit.cloud";
const MAX_QUEUED_MESSAGES = 128;

function safeClose(socket: WebSocket, code = 1000, reason = "") {
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    try {
      socket.close(code >= 1000 && code <= 4999 ? code : 1000, reason.slice(0, 123));
    } catch {
      socket.close();
    }
  }
}

Deno.serve({
  hostname: "0.0.0.0",
  port: Number(Deno.env.get("PORT") ?? "8000"),
}, async (request) => {
  const incomingUrl = new URL(request.url);

  if (incomingUrl.pathname === "/__health") {
    return Response.json({
      ok: true,
      service: "sopranochat-livekit-bridge",
      upstream: UPSTREAM_HTTP,
    });
  }

  const isWebSocket = request.headers.get("upgrade")?.toLowerCase() === "websocket";

  if (!isWebSocket) {
    const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, UPSTREAM_HTTP);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", incomingUrl.host);
    headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

    return await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
  }

  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, UPSTREAM_WS);
  const requestedProtocols = (request.headers.get("sec-websocket-protocol") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const upgradeOptions = requestedProtocols.length > 0
    ? { protocol: requestedProtocols[0], idleTimeout: 0 }
    : { idleTimeout: 0 };

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(request, upgradeOptions);
  clientSocket.binaryType = "arraybuffer";

  const upstreamSocket = requestedProtocols.length > 0
    ? new WebSocket(targetUrl.toString(), requestedProtocols)
    : new WebSocket(targetUrl.toString());
  upstreamSocket.binaryType = "arraybuffer";

  const queuedMessages: Array<string | ArrayBuffer | Blob> = [];
  let upstreamReady = false;
  let closed = false;

  const closeBoth = (code = 1000, reason = "") => {
    if (closed) return;
    closed = true;
    safeClose(clientSocket, code, reason);
    safeClose(upstreamSocket, code, reason);
  };

  clientSocket.addEventListener("message", (event) => {
    if (closed) return;

    if (upstreamReady && upstreamSocket.readyState === WebSocket.OPEN) {
      upstreamSocket.send(event.data);
      return;
    }

    if (queuedMessages.length >= MAX_QUEUED_MESSAGES) {
      closeBoth(1013, "Upstream connection is not ready");
      return;
    }

    queuedMessages.push(event.data);
  });

  clientSocket.addEventListener("close", (event) => {
    closeBoth(event.code || 1000, event.reason);
  });

  clientSocket.addEventListener("error", () => {
    closeBoth(1011, "Client WebSocket error");
  });

  upstreamSocket.addEventListener("open", () => {
    if (closed) return;
    upstreamReady = true;

    for (const message of queuedMessages.splice(0)) {
      upstreamSocket.send(message);
    }
  });

  upstreamSocket.addEventListener("message", (event) => {
    if (!closed && clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(event.data);
    }
  });

  upstreamSocket.addEventListener("close", (event) => {
    closeBoth(event.code || 1000, event.reason);
  });

  upstreamSocket.addEventListener("error", () => {
    closeBoth(1011, "LiveKit upstream connection failed");
  });

  return response;
});
