import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Link,
  Text,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { apiRequest } from "../../api/client";
import {
  connectPhone,
  phoneLink,
  type PhoneSession,
} from "../../lib/phoneCamera";
import { WebcamViewer } from "./WebcamViewer";

export function PhoneCameraPanel() {
  const [base, setBase] = useState(
    import.meta.env.VITE_PHONE_PUBLIC_URL || window.location.origin,
  );
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const closeRef = useRef<(() => void) | null>(null);
  const sessionRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  function stop() {
    generationRef.current += 1;
    closeRef.current?.();
    closeRef.current = null;
    if (sessionRef.current)
      void apiRequest(`/api/phone-camera/sessions/${sessionRef.current}`, {
        method: "DELETE",
      }).catch(() => undefined);
    sessionRef.current = null;
  }
  useEffect(() => () => stop(), []);

  async function create() {
    stop();
    const generation = generationRef.current;
    setStream(null);
    setQr("");
    setLink("");
    setBusy(true);
    setStatus("");
    try {
      phoneLink(
        { id: "", senderToken: "", receiverToken: "", expiresIn: 0 },
        base,
      );
      const session = await apiRequest<PhoneSession>(
        "/api/phone-camera/sessions",
        { method: "POST" },
      );
      if (generation !== generationRef.current) {
        void apiRequest(`/api/phone-camera/sessions/${session.id}`, {
          method: "DELETE",
        }).catch(() => undefined);
        return;
      }
      sessionRef.current = session.id;
      const url = phoneLink(session, base);
      const image = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      if (generation !== generationRef.current) return;
      setQr(image);
      setLink(url);
      closeRef.current = connectPhone(
        session.id,
        session.receiverToken,
        "receiver",
        (message) => {
          setStatus(message);
          if (
            !message.startsWith("Телефон подключён") &&
            !message.startsWith("Ожидание")
          )
            setStream(null);
        },
        setStream,
      );
    } catch (error) {
      if (generation !== generationRef.current) return;
      stop();
      setStatus(
        error instanceof Error ? error.message : "Не удалось создать QR-код",
      );
      setBusy(false);
    } finally {
      if (generation === generationRef.current) setBusy(false);
    }
  }

  return (
    <Box my="5" p="5" borderWidth="1px" borderRadius="2xl" bg="white">
      <Heading size="md">Телефон как камера</Heading>
      <Text my="2">
        Откройте QR-код на телефоне, разрешите камеру и оставьте страницу
        открытой. Анализ выполняется здесь.
      </Text>
      <Text fontSize="sm" color="gray.500">
        Для первого теста подключите оба устройства к одному Wi-Fi. Ссылка
        действует 30 минут. Для нового подключения создайте новый QR-код.
      </Text>
      <Flex gap="2" my="3" wrap="wrap">
        <Input
          aria-label="HTTPS-адрес сайта для телефона"
          value={base}
          onChange={(event) => setBase(event.target.value)}
          flex="1"
          minW="240px"
        />
        <Button disabled={busy} onClick={() => void create()}>
          {busy ? "Создаём…" : "Создать QR-код"}
        </Button>
        {link && (
          <Button
            variant="outline"
            onClick={() => {
              stop();
              setStream(null);
              setQr("");
              setLink("");
              setStatus("Отключено");
            }}>
            Отключить
          </Button>
        )}
      </Flex>
      {qr && (
        <img
          src={qr}
          width="280"
          height="280"
          alt="QR-код подключения камеры телефона"
        />
      )}
      {link && (
        <Link display="block" href={link} overflowWrap="anywhere">
          Открыть страницу камеры
        </Link>
      )}
      <Text role="status" my="3">
        {status}
      </Text>
      {stream && <WebcamViewer externalStream={stream} />}
    </Box>
  );
}

export function PhoneCameraPage() {
  const [status, setStatus] = useState(
    "Нажмите кнопку и разрешите доступ к камере.",
  );
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const closeRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const [pair] = useState(() => {
    const values = new URLSearchParams(window.location.hash.slice(1));
    return { id: values.get("session"), token: values.get("token") };
  });
  function stop() {
    generationRef.current += 1;
    closeRef.current?.();
    closeRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
    return () => stop();
  }, []);
  async function start() {
    stop();
    const generation = generationRef.current;
    setBusy(true);
    try {
      if (!pair.id || !pair.token)
        throw new Error("Откройте свежий QR-код в SecureGuard.");
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error("Камере нужен HTTPS. Откройте защищённый адрес сайта.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 20, max: 24 },
        },
      });
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (generation !== generationRef.current) return;
      closeRef.current = connectPhone(
        pair.id,
        pair.token,
        "sender",
        (message) => {
          setStatus(message);
          if (
            !message.startsWith("Телефон подключён") &&
            !message.startsWith("Ожидание")
          ) {
            stop();
            setActive(false);
          }
        },
        () => undefined,
        stream,
      );
      setActive(true);
    } catch (error) {
      if (generation !== generationRef.current) return;
      stop();
      setActive(false);
      setStatus(
        error instanceof Error ? error.message : "Не удалось запустить камеру",
      );
      setBusy(false);
    } finally {
      if (generation === generationRef.current) setBusy(false);
    }
  }
  return (
    <Box maxW="680px" mx="auto" p="5">
      <Heading size="lg">Камера телефона · SecureGuard</Heading>
      <Text my="3">
        Видео будет передано в открытый интерфейс SecureGuard для анализа. Звук
        отключён.
      </Text>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", background: "#111", borderRadius: 16 }}
      />
      <Text role="status" my="3">
        {status}
      </Text>
      <Button
        disabled={busy}
        onClick={() =>
          active ?
            (stop(),
            setActive(false),
            setStatus(
              "Передача остановлена. Для повторного подключения отсканируйте новый QR-код.",
            ))
          : void start()
        }>
        {active ?
          "Остановить передачу"
        : busy ?
          "Подключаем…"
        : "Включить камеру"}
      </Button>
      <Text mt="4" fontSize="sm">
        Не закрывайте страницу и не блокируйте экран телефона во время передачи.
      </Text>
    </Box>
  );
}
