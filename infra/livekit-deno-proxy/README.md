# SopranoChat LiveKit bridge

A small WebSocket and HTTP reverse proxy that preserves the legacy app endpoint
`wss://video.sopranochat.com` while forwarding LiveKit signaling to the current
LiveKit Cloud project.

## Deployment

- Runtime: Deno Deploy
- Entrypoint: `infra/livekit-deno-proxy/main.ts`
- Health check: `GET /__health`
- Custom domain: `video.sopranochat.com`

The bridge contains no API keys or secrets. LiveKit media flows over WebRTC directly
between clients and LiveKit infrastructure; this service handles signaling only.
