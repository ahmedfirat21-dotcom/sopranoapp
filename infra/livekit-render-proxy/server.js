const http = require("node:http");
const httpProxy = require("http-proxy");

const PORT = Number(process.env.PORT || 10000);
const TARGET = "https://sopranochat-98mbbgjv.livekit.cloud";

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  changeOrigin: true,
  secure: true,
  ws: true,
  xfwd: true,
});

proxy.on("error", (error, req, resOrSocket) => {
  console.error("LiveKit proxy error:", error.message);

  if (resOrSocket && typeof resOrSocket.writeHead === "function") {
    if (!resOrSocket.headersSent) {
      resOrSocket.writeHead(502, { "content-type": "application/json" });
    }
    resOrSocket.end(JSON.stringify({ error: "LiveKit upstream unavailable" }));
    return;
  }

  if (resOrSocket && typeof resOrSocket.destroy === "function") {
    resOrSocket.destroy();
  }
});

const server = http.createServer((req, res) => {
  if (req.url === "/__health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      service: "sopranochat-livekit-bridge",
      upstream: TARGET,
    }));
    return;
  }

  proxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.timeout = 0;
server.keepAliveTimeout = 75_000;
server.headersTimeout = 80_000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SopranoChat LiveKit bridge listening on port ${PORT}`);
});
