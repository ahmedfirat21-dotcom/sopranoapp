# SopranoChat LiveKit signaling bridge

Temporary compatibility bridge for installed mobile clients that still connect to
`wss://video.sopranochat.com`.

The bridge forwards only the LiveKit signaling WebSocket to
`wss://sopranochat-98mbbgjv.livekit.cloud`. WebRTC audio/video continues to
flow directly between clients and LiveKit Cloud.

## Health check

```text
GET /health
```

## Runtime limits

Vercel Hobby functions have a five-minute maximum connection duration. LiveKit
clients are expected to reconnect automatically. A later mobile release should
use the LiveKit Cloud URL directly and remove this compatibility bridge.
