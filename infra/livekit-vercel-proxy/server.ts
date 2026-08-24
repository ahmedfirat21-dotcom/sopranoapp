const LIVEKIT_ORIGIN =
  process.env.LIVEKIT_WS_URL ?? "wss://sopranochat-98mbbgjv.livekit.cloud";

type ClientMessage = string | Buffer;

type SocketData = {
  target: string;
  queue: ClientMessage[];
  upstream?: WebSocket;
  closing?: boolean;
};

function normalizeCloseCode(code: number): number {
  if (code === 1006 || code < 1000 || code > 4999) return 1011;
  return code;
}

function safeCloseUpstream(socket?: WebSocket, code = 1000, reason = "client disconnected") {
  if (!socket) return;
  try {
    if (
      socket.readyState === WebSocket.CONNECTING ||
      socket.readyState === WebSocket.OPEN
    ) {
      socket.close(code, reason);
    }
  } catch {
    // The peer may already have closed between readyState and close().
  }
}

Bun.serve({
  routes: {
    "/": Response.json({
      service: "sopranochat-livekit-signal-proxy",
      status: "ok",
      upstream: new URL(LIVEKIT_ORIGIN).host,
    }),
    "/health": Response.json({ status: "ok" }),
  },

  fetch(request, server) {
    const incoming = new URL(request.url);

    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", {
        status: 426,
        headers: { Upgrade: "websocket" },
      });
    }

    const target = new URL(LIVEKIT_ORIGIN);
    target.pathname = incoming.pathname;
    target.search = incoming.search;

    const upgraded = server.upgrade(request, {
      data: {
        target: target.toString(),
        queue: [],
      } satisfies SocketData,
    });

    if (upgraded) return;
    return new Response("WebSocket upgrade failed", { status: 400 });
  },

  websocket: {
    data: {} as SocketData,
    idleTimeout: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    perMessageDeflate: false,

    open(client) {
      const upstream = new WebSocket(client.data.target);
      upstream.binaryType = "arraybuffer";
      client.data.upstream = upstream;

      upstream.onopen = () => {
        for (const message of client.data.queue) upstream.send(message);
        client.data.queue.length = 0;
      };

      upstream.onmessage = async (event) => {
        if (client.data.closing) return;

        let message = event.data;
        if (message instanceof Blob) message = await message.arrayBuffer();

        try {
          client.send(message as string | ArrayBuffer);
        } catch {
          client.data.closing = true;
          safeCloseUpstream(upstream);
        }
      };

      upstream.onclose = (event) => {
        if (client.data.closing) return;
        client.data.closing = true;
        try {
          client.close(normalizeCloseCode(event.code), event.reason || "upstream closed");
        } catch {
          client.close(1011, "upstream closed");
        }
      };

      upstream.onerror = () => {
        if (client.data.closing) return;
        client.data.closing = true;
        try {
          client.close(1011, "upstream connection failed");
        } catch {
          // The client may already be gone.
        }
      };
    },

    message(client, message) {
      const upstream = client.data.upstream;

      if (!upstream || upstream.readyState === WebSocket.CONNECTING) {
        if (client.data.queue.length >= 256) {
          client.data.closing = true;
          client.close(1013, "upstream not ready");
          safeCloseUpstream(upstream, 1013, "queue limit");
          return;
        }
        client.data.queue.push(message);
        return;
      }

      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(message);
        return;
      }

      client.data.closing = true;
      client.close(1011, "upstream unavailable");
    },

    close(client, code, reason) {
      client.data.closing = true;
      const textReason =
        typeof reason === "string" ? reason : new TextDecoder().decode(reason);
      safeCloseUpstream(
        client.data.upstream,
        normalizeCloseCode(code),
        textReason || "client disconnected",
      );
    },
  },
});
