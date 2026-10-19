import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  IconButton,
  Input,
  NativeSelect,
  Text,
} from "@chakra-ui/react";
import {
  Camera,
  Check,
  Crosshair,
  Info,
  MousePointer2,
  Palette,
  RotateCcw,
  Trash2,
  Undo2,
  Video,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import cameraPreview from "../assets/camera-preview.png";
import {
  useCameraConfigs,
  useCurrentUser,
  useSaveCameraConfig,
} from "../api/queries";
import { useRuntimeConfig } from "../api/runtime";
import type { CameraZoneType } from "../domain/models";

type ZoneType =
  | CameraZoneType
  | "cash-register"
  | "cash-drawer"
  | "scanner"
  | "product"
  | "customer"
  | "pocket"
  | "custom";
type Point = { x: number; y: number };

type Zone = {
  id: string;
  sourceId: string;
  name: string;
  type: ZoneType;
  color: string;
  points: Point[];
};

type WebcamState =
  | "idle"
  | "requesting"
  | "allowed"
  | "denied"
  | "not-found"
  | "busy"
  | "error"
  | "unsupported";

const storageKey = "secureguard-detection-zones-v1";
const zoneTypes: Array<{ value: ZoneType; label: string }> = [
  { value: "cashier_zone", label: "Зона кассира" },
  { value: "scan_zone", label: "Зона сканирования" },
  { value: "transfer_zone", label: "Зона передачи товара" },
  { value: "customer_zone", label: "Зона покупателя" },
  { value: "drawer_zone", label: "Денежный ящик" },
];

const colors = [
  "#2563eb",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Point>;
  return typeof point.x === "number" && typeof point.y === "number";
}

function normalizePoint(point: Point): Point {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
}

function loadZones(): Zone[] {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "[]",
    ) as unknown;
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const stored = item as Partial<Zone> & {
        cameraId?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      };

      let points =
        Array.isArray(stored.points) ?
          stored.points.filter(isPoint).map(normalizePoint)
        : [];
      if (
        points.length < 3 &&
        typeof stored.x === "number" &&
        typeof stored.y === "number" &&
        typeof stored.width === "number" &&
        typeof stored.height === "number"
      ) {
        points = [
          { x: stored.x, y: stored.y },
          { x: stored.x + stored.width, y: stored.y },
          { x: stored.x + stored.width, y: stored.y + stored.height },
          { x: stored.x, y: stored.y + stored.height },
        ].map(normalizePoint);
      }

      if (points.length < 3) return [];
      return [
        {
          id:
            typeof stored.id === "string" ?
              stored.id
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          sourceId:
            typeof stored.sourceId === "string" ?
              stored.sourceId
            : (stored.cameraId ?? "D01"),
          name: typeof stored.name === "string" ? stored.name : "Зона",
          type:
            zoneTypes.some((type) => type.value === stored.type) ?
              (stored.type as ZoneType)
            : "custom",
          color: typeof stored.color === "string" ? stored.color : colors[0],
          points,
        },
      ];
    });
  } catch {
    return [];
  }
}

function zoneTypeLabel(type: ZoneType) {
  return zoneTypes.find((item) => item.value === type)?.label ?? "Зона";
}

function pointFromEvent(event: ReactPointerEvent<HTMLElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return normalizePoint({
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  });
}

function pointsForSvg(points: Point[]) {
  return points
    .map((point) => `${point.x * 1000},${point.y * 562.5}`)
    .join(" ");
}

function transparentColor(hex: string) {
  return `${hex}38`;
}

function webcamErrorState(error: unknown): WebcamState {
  if (!(error instanceof DOMException)) return "error";
  if (error.name === "NotAllowedError" || error.name === "SecurityError")
    return "denied";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError")
    return "not-found";
  if (error.name === "NotReadableError" || error.name === "AbortError")
    return "busy";
  return "error";
}

function webcamMessage(state: WebcamState) {
  if (state === "denied")
    return "Доступ к камере запрещён. Разрешите его в настройках браузера.";
  if (state === "not-found") return "Подключённая камера не найдена.";
  if (state === "busy") return "Камера уже используется другим приложением.";
  if (state === "unsupported")
    return "Для камеры нужен современный браузер и безопасное подключение.";
  if (state === "error")
    return "Не удалось запустить камеру. Попробуйте ещё раз.";
  return "Запустите камеру, чтобы отметить зоны прямо на живом кадре.";
}

export function ZonesPanel() {
  const configs = useCameraConfigs();
  const user = useCurrentUser();
  const runtime = useRuntimeConfig();
  const save = useSaveCameraConfig();
  const [zones, setZones] = useState<Zone[]>(loadZones);
  const [selectedSourceId, setSourceId] = useState("");
  const sourceId = selectedSourceId || configs.data?.[0]?.camera_id || "WEB";
  const [remoteDrafts, setRemoteDrafts] = useState<Record<string, Zone[]>>({});
  const [snapshot, setSnapshot] = useState<{
    sourceId: string;
    url: string;
  } | null>(null);
  const [snapshotAspectRatio, setSnapshotAspectRatio] = useState("16 / 9");
  const [zoneType, setZoneType] = useState<ZoneType>("cashier_zone");
  const [name, setName] = useState("Зона кассира");
  const [color, setColor] = useState(colors[0]);
  const [drawing, setDrawing] = useState(false);
  const [zoneValidation, setZoneValidation] = useState("");
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [webcamState, setWebcamState] = useState<WebcamState>(() =>
    !window.isSecureContext || !navigator.mediaDevices?.getUserMedia ?
      "unsupported"
    : "idle",
  );
  const [webcamAspectRatio, setWebcamAspectRatio] = useState("16 / 9");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const config = configs.data?.find((camera) => camera.camera_id === sourceId);
  const isWebcam = sourceId === "WEB";
  const canConfigure =
    user.data?.role === "admin" || user.data?.role === "manager";
  const demo = runtime.data?.demoMode === true;
  const sourceZones =
    isWebcam ?
      zones.filter((zone) => zone.sourceId === "WEB")
    : (remoteDrafts[sourceId] ??
      config?.zones.map((zone, index) => ({
        id: zone.id,
        sourceId,
        type: zone.type,
        name: zoneTypeLabel(zone.type),
        color: colors[index % colors.length],
        points: zone.points.map(([x, y]) => ({ x, y })),
      })) ??
      []);
  const snapshotUrl =
    snapshot?.sourceId === sourceId ? snapshot.url
    : demo ? cameraPreview
    : "";
  const canDraw =
    isWebcam ?
      webcamState === "allowed"
    : !!config && !!snapshotUrl && canConfigure;
  const hasDraft = remoteDrafts[sourceId] !== undefined;

  useEffect(
    () => () => {
      if (snapshot) URL.revokeObjectURL(snapshot.url);
    },
    [snapshot],
  );

  function updateSourceZones(next: Zone[]) {
    if (isWebcam)
      setZones((current) => [
        ...current.filter((zone) => zone.sourceId !== "WEB"),
        ...next,
      ]);
    else setRemoteDrafts((current) => ({ ...current, [sourceId]: next }));
  }

  async function saveRemoteZones() {
    if (!config) return;
    try {
      await save.mutateAsync({
        ...config,
        zones: sourceZones.map((zone) => ({
          id: zone.id,
          type: zone.type as CameraZoneType,
          points: zone.points.map(({ x, y }) => [x, y]),
        })),
      });
      setRemoteDrafts((current) => {
        const next = { ...current };
        delete next[sourceId];
        return next;
      });
    } catch {
      /* Keep the draft visible so the operator can retry. */
    }
  }

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(zones));
    } catch {
      // Local storage can be unavailable in privacy modes.
    }
  }, [zones]);

  useEffect(() => () => stopWebcam(), [stopWebcam]);

  function selectType(value: ZoneType) {
    setZoneType(value);
    setName(zoneTypeLabel(value));
  }

  function cancelDrawing() {
    setDrawing(false);
    setDraftPoints([]);
  }

  function selectSource(value: string) {
    cancelDrawing();
    if (value !== "WEB") {
      stopWebcam();
      setWebcamState((current) =>
        current === "unsupported" ? current : "idle",
      );
    }
    setSourceId(value);
  }

  function startDrawing() {
    if (!canDraw) return;
    if (!isWebcam && sourceZones.length >= 20) {
      setZoneValidation("На одной камере допускается не больше 20 зон.");
      return;
    }
    setZoneValidation("");
    setDraftPoints([]);
    setDrawing(true);
  }

  function finishZone() {
    if (draftPoints.length < 3) return;
    const area = draftPoints.reduce((sum, a, index) => {
      const b = draftPoints[(index + 1) % draftPoints.length];
      return sum + a.x * b.y - b.x * a.y;
    }, 0);
    if (Math.abs(area) < 1e-6) {
      setZoneValidation("Точки должны образовать область, а не прямую линию.");
      return;
    }
    setZoneValidation("");
    updateSourceZones([
      ...sourceZones,
      {
        id:
          crypto.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sourceId,
        name: name.trim() || zoneTypeLabel(zoneType),
        type: zoneType,
        color,
        points: draftPoints,
      },
    ]);
    cancelDrawing();
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawing || !canDraw || event.button !== 0) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    const firstPoint = draftPoints[0];
    const isClosingPoint =
      firstPoint &&
      draftPoints.length >= 3 &&
      Math.hypot(point.x - firstPoint.x, point.y - firstPoint.y) < 0.035;
    if (isClosingPoint) {
      finishZone();
      return;
    }
    if (draftPoints.length >= 64) {
      setZoneValidation(
        "В одной зоне допускается не больше 64 точек. Завершите контур.",
      );
      return;
    }
    setDraftPoints((current) => [...current, point]);
  }

  async function startWebcam() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setWebcamState("unsupported");
      return;
    }

    setWebcamState("requesting");
    stopWebcam();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setWebcamState("allowed");
    } catch (error) {
      stopWebcam();
      setWebcamState(webcamErrorState(error));
    }
  }

  function removeZone(id: string) {
    updateSourceZones(sourceZones.filter((zone) => zone.id !== id));
  }

  function clearSourceZones() {
    updateSourceZones([]);
    cancelDrawing();
  }

  return (
    <Box px={{ base: "5", md: "8" }} pb="12">
      <Flex
        align={{ base: "flex-start", lg: "center" }}
        justify="space-between"
        direction={{ base: "column", lg: "row" }}
        gap="4"
        mb="6">
        <Box>
          <Heading as="h2" size="xl">
            Зоны контроля
          </Heading>
          <Text mt="2" maxW="780px" color="gray.500">
            Отмечайте кассу, денежный ящик и другие области точками. Полигон
            сохраняется отдельно для выбранной камеры.
          </Text>
        </Box>
        <Flex
          align="center"
          gap="2"
          border="1px solid"
          borderColor="green.200"
          borderRadius="full"
          bg="green.50"
          color="green.700"
          px="3"
          py="2"
          fontSize="sm"
          fontWeight="800">
          <Box
            boxSize="2"
            borderRadius="full"
            bg={hasDraft ? "orange.500" : "green.500"}
          />{" "}
          {isWebcam ?
            "Локальное автосохранение"
          : hasDraft ?
            "Есть несохранённые изменения"
          : "Конфигурация сервера"}
        </Flex>
      </Flex>

      <Grid
        templateColumns={{
          base: "1fr",
          xl: "minmax(0, 1.7fr) minmax(300px, .7fr)",
        }}
        gap="5"
        alignItems="start">
        <Box
          overflow="hidden"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="2xl"
          bg="white"
          boxShadow="0 12px 36px rgba(15, 23, 42, .07)">
          <Flex
            align={{ base: "stretch", md: "center" }}
            justify="space-between"
            direction={{ base: "column", md: "row" }}
            gap="3"
            borderBottom="1px solid"
            borderColor="gray.100"
            p="4">
            <Flex align="center" gap="3">
              <Flex
                boxSize="10"
                align="center"
                justify="center"
                borderRadius="xl"
                bg="blue.50"
                color="blue.600">
                <Camera size={19} />
              </Flex>
              <Box>
                <Text fontWeight="800">Кадр для разметки</Text>
                <Text color="gray.500" fontSize="xs">
                  Точки сохраняются в координатах 0–1 и не зависят от размера
                  окна
                </Text>
              </Box>
            </Flex>
            <NativeSelect.Root size="sm" w={{ base: "full", md: "250px" }}>
              <NativeSelect.Field
                aria-label="Источник для разметки"
                value={sourceId}
                onChange={(event) => selectSource(event.target.value)}>
                {configs.data?.map((source) => (
                  <option key={source.camera_id} value={source.camera_id}>
                    {source.camera_id} · {source.name}
                  </option>
                ))}
                <option value="WEB">WEB · Локальная веб-камера</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Flex>

          {!isWebcam && (
            <Box px="4" py="3" bg="gray.50">
              <Text as="label" fontSize="sm" fontWeight="700">
                Кадр выбранной камеры
                <Input
                  aria-label="Кадр выбранной камеры"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  mt="2"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (
                      file &&
                      file.size <= 20 * 1024 * 1024 &&
                      file.type.startsWith("image/")
                    )
                      setSnapshot({ sourceId, url: URL.createObjectURL(file) });
                  }}
                />
              </Text>
              <Text mt="1" fontSize="xs" color="gray.500">
                Выберите актуальный кадр камеры (до 20 МБ). Изображение остаётся
                в браузере; на сервер отправляются только координаты зон.
                {demo && !snapshot ?
                  " Сейчас показан демонстрационный кадр."
                : ""}
              </Text>
            </Box>
          )}

          <Box
            data-testid="zone-canvas"
            position="relative"
            overflow="hidden"
            bg="gray.950"
            backgroundPosition="center"
            backgroundSize="cover"
            cursor={drawing ? "crosshair" : "default"}
            style={{
              aspectRatio: isWebcam ? webcamAspectRatio : snapshotAspectRatio,
              touchAction: drawing ? "none" : "auto",
              userSelect: "none",
            }}
            onPointerDown={handleCanvasPointerDown}>
            {!isWebcam && snapshotUrl && (
              <img
                src={snapshotUrl}
                alt="Кадр для настройки зон"
                onLoad={(event) =>
                  setSnapshotAspectRatio(
                    `${event.currentTarget.naturalWidth} / ${event.currentTarget.naturalHeight}`,
                  )
                }
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            )}
            {isWebcam && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  if (video.videoWidth && video.videoHeight)
                    setWebcamAspectRatio(
                      `${video.videoWidth} / ${video.videoHeight}`,
                    );
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transform: "scaleX(-1)",
                }}
              />
            )}

            <svg
              aria-label="Размеченные зоны"
              viewBox="0 0 1000 562.5"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}>
              {sourceZones.map((zone, index) => (
                <g key={zone.id}>
                  <polygon
                    points={pointsForSvg(zone.points)}
                    fill={transparentColor(zone.color)}
                    stroke="rgba(3,7,18,.92)"
                    strokeWidth="9"
                    strokeLinejoin="round"
                  />
                  <polygon
                    points={pointsForSvg(zone.points)}
                    fill={transparentColor(zone.color)}
                    stroke={zone.color}
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                  {zone.points.map((point, pointIndex) => (
                    <circle
                      key={pointIndex}
                      cx={point.x * 1000}
                      cy={point.y * 562.5}
                      r="7"
                      fill={zone.color}
                      stroke="white"
                      strokeWidth="3"
                    />
                  ))}
                  <text
                    x={zone.points[0].x * 1000 + 12}
                    y={Math.max(24, zone.points[0].y * 562.5 - 12)}
                    fill="white"
                    stroke="rgba(3,7,18,.95)"
                    strokeWidth="5"
                    paintOrder="stroke"
                    fontSize="18"
                    fontWeight="900">
                    {index + 1}. {zone.name}
                  </text>
                </g>
              ))}
              {draftPoints.length > 0 && (
                <g>
                  <polyline
                    points={pointsForSvg(draftPoints)}
                    fill={
                      draftPoints.length >= 3 ? transparentColor(color) : "none"
                    }
                    stroke="rgba(3,7,18,.95)"
                    strokeWidth="10"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={pointsForSvg(draftPoints)}
                    fill={
                      draftPoints.length >= 3 ? transparentColor(color) : "none"
                    }
                    stroke={color}
                    strokeWidth="5"
                    strokeDasharray="12 8"
                    strokeLinejoin="round"
                  />
                  {draftPoints.map((point, index) => (
                    <circle
                      key={index}
                      cx={point.x * 1000}
                      cy={point.y * 562.5}
                      r={index === 0 ? 11 : 8}
                      fill={index === 0 ? "white" : color}
                      stroke={index === 0 ? color : "white"}
                      strokeWidth="4"
                    />
                  ))}
                </g>
              )}
            </svg>

            {isWebcam && webcamState !== "allowed" && (
              <Flex
                position="absolute"
                inset="0"
                zIndex="2"
                align="center"
                justify="center"
                p="6"
                onPointerDown={(event) => event.stopPropagation()}>
                <Flex
                  direction="column"
                  align="center"
                  gap="3"
                  maxW="390px"
                  borderRadius="2xl"
                  bg="blackAlpha.800"
                  color="white"
                  px="6"
                  py="5"
                  textAlign="center"
                  backdropFilter="blur(8px)">
                  <Video size={26} />
                  <Text fontWeight="800">Локальная веб-камера</Text>
                  <Text color="whiteAlpha.800" fontSize="sm">
                    {webcamState === "requesting" ?
                      "Ожидаем разрешение браузера…"
                    : webcamMessage(webcamState)}
                  </Text>
                  <Button
                    size="sm"
                    disabled={
                      webcamState === "requesting" ||
                      webcamState === "unsupported"
                    }
                    onClick={() => void startWebcam()}>
                    {webcamState === "requesting" ?
                      "Подключение…"
                    : "Запустить камеру"}
                  </Button>
                </Flex>
              </Flex>
            )}

            {!isWebcam && sourceZones.length === 0 && !drawing && (
              <Flex
                position="absolute"
                inset="0"
                align="center"
                justify="center"
                p="6"
                pointerEvents="none">
                <Flex
                  direction="column"
                  align="center"
                  gap="3"
                  maxW="350px"
                  borderRadius="2xl"
                  bg="blackAlpha.700"
                  color="white"
                  px="6"
                  py="5"
                  textAlign="center"
                  backdropFilter="blur(8px)">
                  <MousePointer2 size={24} />
                  <Text fontWeight="800">Для этого источника пока нет зон</Text>
                  <Text color="whiteAlpha.800" fontSize="sm">
                    {snapshotUrl ?
                      "Настройте параметры справа и нажмите «Начать по точкам»."
                    : "Выберите кадр этой камеры, затем отметьте зоны."}
                  </Text>
                </Flex>
              </Flex>
            )}

            {drawing && (
              <Flex
                position="absolute"
                top="3"
                left="50%"
                zIndex="1"
                align="center"
                gap="2"
                borderRadius="full"
                bg="blackAlpha.800"
                color="white"
                px="4"
                py="2"
                fontSize="sm"
                fontWeight="800"
                transform="translateX(-50%)"
                pointerEvents="none">
                <Crosshair size={16} /> Поставьте минимум 3 точки · сейчас{" "}
                {draftPoints.length}
              </Flex>
            )}
          </Box>

          <Flex
            align="center"
            gap="2"
            borderTop="1px solid"
            borderColor="gray.100"
            bg="gray.50"
            px="4"
            py="3">
            <Info size={16} />
            <Text color="gray.600" fontSize="xs">
              Замкните контур нажатием на первую точку или кнопкой «Завершить».{" "}
              {isWebcam ?
                "Зоны веб-камеры сохраняются в этом браузере."
              : "Нажмите «Сохранить зоны», чтобы агент получил новую разметку."}
            </Text>
          </Flex>
        </Box>

        <Flex direction="column" gap="4">
          <Box
            border="1px solid"
            borderColor="gray.200"
            borderRadius="2xl"
            bg="white"
            boxShadow="0 12px 36px rgba(15, 23, 42, .06)"
            p="5">
            <Heading size="md">Новая зона</Heading>
            <Text mt="1" color="gray.500" fontSize="sm">
              Выберите тип, цвет и обведите нужную область точками.
            </Text>

            <Text
              as="label"
              display="block"
              mt="5"
              mb="2"
              fontSize="sm"
              fontWeight="800">
              Тип зоны
            </Text>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={zoneType}
                onChange={(event) =>
                  selectType(event.target.value as ZoneType)
                }>
                {zoneTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>

            <Text
              as="label"
              display="block"
              mt="4"
              mb="2"
              fontSize="sm"
              fontWeight="800">
              Название
            </Text>
            <Input
              value={name}
              maxLength={48}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, основной денежный ящик"
            />

            <Flex align="center" gap="2" mt="4" mb="2">
              <Palette size={16} />
              <Text fontSize="sm" fontWeight="800">
                Цвет разметки
              </Text>
            </Flex>
            <Flex gap="2" wrap="wrap">
              {colors.map((option) => (
                <IconButton
                  key={option}
                  aria-label={`Выбрать цвет ${option}`}
                  boxSize="34px"
                  minW="34px"
                  border="3px solid"
                  borderColor={color === option ? "gray.900" : "transparent"}
                  borderRadius="full"
                  bg={option}
                  _hover={{ transform: "scale(1.08)" }}
                  onClick={() => setColor(option)}
                />
              ))}
            </Flex>

            {!drawing ?
              <Button
                mt="5"
                w="full"
                bg="blue.600"
                color="white"
                disabled={!canDraw}
                _hover={{ bg: "blue.700" }}
                onClick={startDrawing}>
                <Crosshair size={18} /> Начать по точкам
              </Button>
            : <Flex direction="column" gap="2" mt="5">
                <Button
                  w="full"
                  bg="green.600"
                  color="white"
                  disabled={draftPoints.length < 3}
                  _hover={{ bg: "green.700" }}
                  onClick={finishZone}>
                  <Check size={18} /> Завершить · {draftPoints.length} точек
                </Button>
                <Grid templateColumns="1fr 1fr" gap="2">
                  <Button
                    variant="outline"
                    disabled={draftPoints.length === 0}
                    onClick={() =>
                      setDraftPoints((current) => current.slice(0, -1))
                    }>
                    <Undo2 size={17} /> Назад
                  </Button>
                  <Button variant="outline" onClick={cancelDrawing}>
                    <RotateCcw size={17} /> Отмена
                  </Button>
                </Grid>
              </Flex>
            }
            {isWebcam && webcamState !== "allowed" && (
              <Text mt="3" color="orange.600" fontSize="xs">
                Сначала запустите веб-камеру в окне слева.
              </Text>
            )}
            {zoneValidation && (
              <Text mt="3" role="alert" color="orange.700" fontSize="sm">
                {zoneValidation}
              </Text>
            )}
          </Box>

          <Box
            border="1px solid"
            borderColor="gray.200"
            borderRadius="2xl"
            bg="white"
            boxShadow="0 12px 36px rgba(15, 23, 42, .06)"
            p="5">
            <Flex align="center" justify="space-between" gap="3">
              <Box>
                <Heading size="md">Зоны {sourceId}</Heading>
                <Text mt="1" color="gray.500" fontSize="sm">
                  Создано: {sourceZones.length}
                </Text>
              </Box>
              {sourceZones.length > 0 && (isWebcam || canConfigure) && (
                <Button
                  size="sm"
                  variant="ghost"
                  color="red.600"
                  onClick={clearSourceZones}>
                  <Trash2 size={16} /> Очистить
                </Button>
              )}
            </Flex>

            <Flex direction="column" gap="2" mt="4">
              {sourceZones.map((zone, index) => (
                <Flex
                  key={zone.id}
                  align="center"
                  gap="3"
                  border="1px solid"
                  borderColor="gray.100"
                  borderRadius="xl"
                  p="3">
                  <Flex
                    boxSize="9"
                    flex="0 0 auto"
                    align="center"
                    justify="center"
                    borderRadius="lg"
                    bg={transparentColor(zone.color)}
                    color={zone.color}
                    fontSize="sm"
                    fontWeight="900">
                    {index + 1}
                  </Flex>
                  <Box minW="0" flex="1">
                    <Text
                      overflow="hidden"
                      fontSize="sm"
                      fontWeight="800"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap">
                      {zone.name}
                    </Text>
                    <Text mt="0.5" color="gray.500" fontSize="xs">
                      {zoneTypeLabel(zone.type)} · {zone.points.length} точек
                    </Text>
                  </Box>
                  {(isWebcam || canConfigure) && (
                    <IconButton
                      aria-label={`Удалить зону ${zone.name}`}
                      size="sm"
                      variant="ghost"
                      color="gray.500"
                      onClick={() => removeZone(zone.id)}>
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </Flex>
              ))}
              {sourceZones.length === 0 && (
                <Text py="4" color="gray.500" fontSize="sm" textAlign="center">
                  Зоны появятся здесь после разметки.
                </Text>
              )}
            </Flex>
            {!isWebcam && canConfigure && (
              <Button
                mt="4"
                w="full"
                colorPalette="blue"
                disabled={!hasDraft || drawing}
                loading={save.isPending}
                onClick={() => void saveRemoteZones()}>
                Сохранить зоны
              </Button>
            )}
            {save.isError && (
              <Text mt="2" role="alert" color="red.700">
                {save.error.message}
              </Text>
            )}
            {!isWebcam && save.isSuccess && !hasDraft && (
              <Text mt="2" role="status" color="green.700">
                Зоны сохранены на сервере
              </Text>
            )}
            {configs.isError && (
              <Text role="alert" color="red.700">
                Не удалось загрузить конфигурацию камер
              </Text>
            )}
          </Box>
        </Flex>
      </Grid>
    </Box>
  );
}
