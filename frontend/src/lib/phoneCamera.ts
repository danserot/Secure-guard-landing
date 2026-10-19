import { apiUrl } from "../api/client";

export type PhoneSession = {
  id: string;
  receiverToken: string;
  senderToken: string;
  expiresIn: number;
};

export function phoneLink(session: PhoneSession, base: string): string {
  const url = new URL("/phone-camera", base);
  if (url.protocol !== "https:")
    throw new Error("Для камеры телефона нужен доступный HTTPS-адрес сайта.");
  url.hash = new URLSearchParams({
    session: session.id,
    token: session.senderToken,
  }).toString();
  return url.toString();
}

export function connectPhone(
  id: string,
  token: string,
  role: "sender" | "receiver",
  onStatus: (message: string) => void,
  onStream: (stream: MediaStream) => void,
  stream?: MediaStream,
): () => void {
  const iceServers = JSON.parse(
    import.meta.env.VITE_PHONE_ICE_SERVERS || "[]",
  ) as RTCIceServer[];
  const peer = new RTCPeerConnection({ iceServers });
  const url = new URL(
    apiUrl(`/api/phone-camera/sessions/${encodeURIComponent(id)}/${role}`),
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(url);
  let disposed = false;
  let timeout: number | undefined;
  let cancelGathering: (() => void) | undefined;
  let signaling = Promise.resolve();
  const remoteStreams = new Set<MediaStream>();
  function startTimeout() {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      if (peer.connectionState !== "connected")
        fail(
          "Не удалось соединиться. Проверьте Wi-Fi и создайте новый QR-код.",
        );
    }, 45000);
  }
  function close() {
    if (disposed) return;
    disposed = true;
    window.clearTimeout(timeout);
    cancelGathering?.();
    remoteStreams.forEach((remote) =>
      remote.getTracks().forEach((track) => track.stop()),
    );
    remoteStreams.clear();
    socket.close();
    peer.close();
  }
  function fail(message: string) {
    if (!disposed) {
      onStatus(message);
      close();
    }
  }
  async function sendDescription(description: RTCSessionDescriptionInit) {
    if (disposed) return;
    await peer.setLocalDescription(description);
    if (disposed) return;
    // Send complete SDP once ICE candidates have been collected.
    if (peer.iceGatheringState !== "complete") {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          cleanup();
          reject(new Error("Сбор сетевых адресов превысил время ожидания"));
        }, 15000);
        const changed = () => {
          if (peer.iceGatheringState === "complete") {
            cleanup();
            resolve();
          }
        };
        function cleanup() {
          window.clearTimeout(timer);
          peer.removeEventListener("icegatheringstatechange", changed);
          cancelGathering = undefined;
        }
        cancelGathering = () => {
          cleanup();
          reject(new DOMException("Phone connection closed", "AbortError"));
        };
        peer.addEventListener("icegatheringstatechange", changed);
        changed();
      });
    }
    if (!disposed && socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(peer.localDescription));
  }
  stream?.getTracks().forEach((track) => peer.addTrack(track, stream));
  peer.ontrack = (event) => {
    if (!disposed && event.streams[0]) {
      remoteStreams.add(event.streams[0]);
      onStream(event.streams[0]);
    }
  };
  peer.onconnectionstatechange = () => {
    if (disposed) return;
    if (peer.connectionState === "connected") {
      window.clearTimeout(timeout);
      onStatus("Телефон подключён · поток передаётся");
    }
    if (["failed", "disconnected"].includes(peer.connectionState))
      fail("Связь с телефоном потеряна. Создайте новый QR-код.");
  };
  socket.onopen = () => {
    if (!disposed) {
      socket.send(token);
      onStatus("Ожидание подключения второго устройства…");
    }
  };
  socket.onmessage = (event) => {
    if (disposed) return;
    signaling = signaling
      .then(async () => {
        if (disposed) return;
        const message = JSON.parse(event.data) as {
          type: string;
          sdp?: string;
        };
        if (message.type === "ready" && role === "sender") {
          startTimeout();
          await sendDescription(await peer.createOffer());
        }
        if (message.type === "offer" && role === "receiver") {
          startTimeout();
          await peer.setRemoteDescription({ type: "offer", sdp: message.sdp });
          if (disposed) return;
          await sendDescription(await peer.createAnswer());
        }
        if (message.type === "answer" && role === "sender")
          await peer.setRemoteDescription({ type: "answer", sdp: message.sdp });
      })
      .catch((error: unknown) =>
        fail(error instanceof Error ? error.message : "Ошибка подключения"),
      );
  };
  socket.onerror = () => fail("Сервер подключения недоступен");
  socket.onclose = () => {
    if (!disposed) fail("Сессия закрыта или истекла. Создайте новый QR-код.");
  };
  return close;
}
