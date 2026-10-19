import { afterEach, describe, expect, it, vi } from "vitest";
import { connectPhone, phoneLink } from "./phoneCamera";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("phone pairing link", () => {
  const session = {
    id: "session-id",
    senderToken: "sender-secret",
    receiverToken: "receiver-secret",
    expiresIn: 1800,
  };
  it("keeps the phone capability in the fragment and excludes the receiver secret", () => {
    const url = new URL(
      phoneLink(session, "https://camera.example.com/cameras"),
    );
    expect(url.pathname).toBe("/phone-camera");
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get("token")).toBe(
      "sender-secret",
    );
    expect(url.toString()).not.toContain("receiver-secret");
  });
  it("rejects LAN HTTP where camera permission is unavailable", () => {
    expect(() => phoneLink(session, "http://192.168.1.10:5173")).toThrow(
      "HTTPS",
    );
  });
});

it("clears ICE gathering and connection deadlines on close and ignores late callbacks", async () => {
  vi.useFakeTimers();
  class Peer extends EventTarget {
    static instance: Peer;
    iceGatheringState = "gathering";
    connectionState = "new";
    localDescription: RTCSessionDescriptionInit | null = null;
    ontrack?: (event: { streams: MediaStream[] }) => void;
    onconnectionstatechange?: () => void;
    constructor() {
      super();
      Peer.instance = this;
    }
    createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "test" });
    setLocalDescription = vi.fn(
      async (description: RTCSessionDescriptionInit) => {
        this.localDescription = description;
      },
    );
    close = vi.fn();
  }
  class Socket {
    static OPEN = 1;
    static instance: Socket;
    readyState = 1;
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    onclose?: () => void;
    send = vi.fn();
    close = vi.fn();
    constructor() {
      Socket.instance = this;
    }
  }
  vi.stubGlobal("RTCPeerConnection", Peer);
  vi.stubGlobal("WebSocket", Socket);
  const onStatus = vi.fn();
  const onStream = vi.fn();
  const close = connectPhone(
    "session-id",
    "test-secret",
    "sender",
    onStatus,
    onStream,
  );
  Socket.instance.onopen!();
  Socket.instance.onmessage!({ data: JSON.stringify({ type: "ready" }) });
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(2);
  const stopTrack = vi.fn();
  Peer.instance.ontrack!({
    streams: [
      { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream,
    ],
  });
  expect(onStream).toHaveBeenCalledOnce();
  close();
  close();
  await vi.advanceTimersByTimeAsync(60000);
  expect(vi.getTimerCount()).toBe(0);
  expect(Peer.instance.close).toHaveBeenCalledOnce();
  expect(Socket.instance.close).toHaveBeenCalledOnce();
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(onStatus).toHaveBeenCalledOnce();
  Socket.instance.onopen!();
  Socket.instance.onmessage!({ data: JSON.stringify({ type: "ready" }) });
  Peer.instance.ontrack!({ streams: [{} as MediaStream] });
  expect(onStatus).toHaveBeenCalledOnce();
  expect(onStream).toHaveBeenCalledOnce();
});
