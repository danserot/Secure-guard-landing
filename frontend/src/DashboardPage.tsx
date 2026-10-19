import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  IconButton,
  Text,
} from "@chakra-ui/react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Gauge,
  Hand,
  ImageIcon,
  Lock,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  ShieldCheck,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import cameraPreview from "./assets/camera-preview.png";
import {
  architectureLayers,
  incidentScenarios,
  navigationItems,
  pagePaths,
  productMetrics,
  roadmapStages,
  type PageId,
} from "./productContent";
import { ArchitectureMap } from "./widgets/ArchitectureMap";
import { IncidentPreview } from "./widgets/IncidentPreview";
import { MetricStrip } from "./widgets/MetricStrip";
import { RoadmapTimeline } from "./widgets/RoadmapTimeline";
import { SidebarNav } from "./widgets/SidebarNav";
import { SettingsPanel } from "./widgets/WorkspaceSettingsPanel";
import { AppActions } from "./widgets/AppActions";
import { IncidentsPanel } from "./widgets/IncidentsPanel";
import { AnalyticsPanel } from "./widgets/AnalyticsPanel";
import { PosEventsPanel } from "./widgets/PosEventsPanel";
import { ZonesPanel } from "./widgets/ZonesPanel";
import { CameraManagement } from "./widgets/CameraManagement";
import { PhoneCameraPanel } from "./components/camera/PhoneCamera";
import { useCameras, useEventAnalytics } from "./api/queries";
import { useRuntimeConfig } from "./api/runtime";
import { RuntimeNotice } from "./widgets/RuntimeNotice";
import type { Camera as CameraSlot } from "./domain/models";

const WebcamModal = lazy(() =>
  import("./components/camera/WebcamModal").then((module) => ({
    default: module.WebcamModal,
  })),
);
const WebcamViewer = lazy(() =>
  import("./components/camera/WebcamViewer").then((module) => ({
    default: module.WebcamViewer,
  })),
);

const webcamStorageKey = "secureguard.webcam-added";

const emptyCameras: CameraSlot[] = [];

const staffRows = [
  ["Алина К.", "Смена открыта", "Касса 1", "2 события"],
  ["Руслан М.", "Перерыв", "Касса 2", "0 событий"],
  ["Мария С.", "Смена закрыта", "Касса 3", "1 событие"],
];
const pageTitles: Record<PageId, string> = {
  overview: "Обзор пилота",
  cameras: "Камеры",
  zones: "Зоны",
  incidents: "Инциденты",
  pos: "POS-события",
  analytics: "Аналитика",
  staff: "Сотрудники",
  settings: "Настройки",
};

export function DashboardPage({ activePage }: { activePage: PageId }) {
  const navigate = useNavigate();
  const camerasQuery = useCameras();
  const cameraSlots = camerasQuery.data ?? emptyCameras;
  const [selectedCamera, setSelectedCamera] = useState<CameraSlot | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [webcamAdded, setWebcamAdded] = useState(() => {
    try {
      return window.localStorage.getItem(webcamStorageKey) === "true";
    } catch {
      return false;
    }
  });
  const changePage = (page: PageId) => navigate({ to: pagePaths[page] });

  function addWebcam() {
    try {
      window.localStorage.setItem(webcamStorageKey, "true");
    } catch {
      /* Storage can be unavailable. */
    }
    setWebcamAdded(true);
    setWebcamOpen(false);
  }

  function removeWebcam() {
    try {
      window.localStorage.removeItem(webcamStorageKey);
    } catch {
      /* Storage can be unavailable. */
    }
    setWebcamAdded(false);
  }

  return (
    <Flex
      minH="100svh"
      bg="linear-gradient(180deg, rgba(232,240,255,.82), rgba(246,247,251,.94) 240px), #f5f7fb">
      <SidebarNav
        activePage={activePage}
        items={navigationItems}
        onPageChange={changePage}
      />
      <Box as="main" minW="0" w="full" flex="1" pb={{ base: "78px", lg: "0" }}>
        <AppActions
          activePage={activePage}
          pageTitle={pageTitles[activePage]}
          onNavigate={changePage}
          onCameraAdd={() => setWebcamOpen(true)}
          cameraAdded={webcamAdded}
        />
        <RuntimeNotice />
        <PageContent
          page={activePage}
          cameras={cameraSlots}
          onCameraSelect={setSelectedCamera}
          webcamAdded={webcamAdded}
          onWebcamRemove={removeWebcam}
        />
      </Box>
      {selectedCamera && (
        <CameraModal
          camera={selectedCamera}
          onClose={() => setSelectedCamera(null)}
        />
      )}
      {webcamOpen && (
        <Suspense fallback={null}>
          <WebcamModal
            onAdded={addWebcam}
            onClose={() => setWebcamOpen(false)}
          />
        </Suspense>
      )}
    </Flex>
  );
}

function PageContent({
  cameras,
  page,
  onCameraSelect,
  onWebcamRemove,
  webcamAdded,
}: {
  cameras: CameraSlot[];
  page: PageId;
  onCameraSelect: (camera: CameraSlot) => void;
  onWebcamRemove: () => void;
  webcamAdded: boolean;
}) {
  const runtime = useRuntimeConfig();
  const demo = runtime.data?.demoMode === true;
  switch (page) {
    case "cameras":
      return (
        <Panel>
          <SectionIntro
            title="Каналы камер"
            text="Подключайте камеры магазина, проверяйте связь и настраивайте зоны контроля."
          />
          <CameraManagement />
          <PhoneCameraPanel />
          <DeviceCard
            cameras={cameras}
            onCameraSelect={onCameraSelect}
            webcamAdded={webcamAdded}
            onWebcamRemove={onWebcamRemove}
          />
        </Panel>
      );
    case "zones":
      return <ZonesPanel />;
    case "incidents":
      return <IncidentsPanel />;
    case "pos":
      return <PosEventsPanel />;
    case "analytics":
      return <AnalyticsPanel />;
    case "staff":
      return (
        <TablePage
          title="Сотрудники и смены"
          text="Контекст смен без распознавания лиц."
          headers={["Сотрудник", "Статус", "Касса", "Инциденты"]}
          rows={demo ? staffRows : []}
        />
      );
    case "settings":
      return <SettingsPanel />;
    default:
      return (
        <OverviewPage
          cameras={cameras}
          onCameraSelect={onCameraSelect}
          demo={demo}
        />
      );
  }
}

function OverviewPage({
  cameras,
  onCameraSelect,
  demo,
}: {
  cameras: CameraSlot[];
  onCameraSelect: (camera: CameraSlot) => void;
  demo: boolean;
}) {
  return (
    <>
      <Grid
        as="section"
        templateColumns={{
          base: "1fr",
          xl: "minmax(0,1.05fr) minmax(390px,.95fr)",
        }}
        gap="10"
        alignItems="center"
        px={{ base: "5", md: "8" }}
        py="10">
        <Box maxW="760px">
          <Text
            mb="4"
            color="blue.600"
            fontSize="xs"
            fontWeight="800"
            letterSpacing=".12em"
            textTransform="uppercase">
            CashGuard AI
          </Text>
          <Heading
            as="h2"
            fontSize={{ base: "3xl", md: "5xl", xl: "6xl" }}
            lineHeight="1">
            Видеоаналитика кассовой зоны с локальной обработкой
          </Heading>
          <Text mt="6" maxW="680px" color="gray.500" fontSize="lg">
            Панель объединяет камеры, live-поток, инциденты, POS-события,
            аналитику пилота и настройки edge-агентов.
          </Text>
        </Box>
        {demo && <IncidentPreview scenarios={incidentScenarios} />}
      </Grid>
      {demo && <MetricStrip metrics={productMetrics} />}
      <OverviewMetrics />
      <ContentSection
        title="Устройства пилота"
        text="Доступность камер и параметры записи. Секреты подключения хранятся на агенте магазина.">
        <DeviceCard cameras={cameras} onCameraSelect={onCameraSelect} />
      </ContentSection>
      <ContentSection
        title="Текущая архитектура по слоям"
        text="CV сообщает проверяемые факты, backend управляет событиями, а окончательное решение принимает оператор.">
        <ArchitectureMap layers={architectureLayers} />
      </ContentSection>
      <ContentSection
        title="Статус технического маршрута"
        text="Готовые части отделены от следующего этапа, чтобы интерфейс не обещал ещё не реализованные возможности.">
        <RoadmapTimeline stages={roadmapStages} />
      </ContentSection>
    </>
  );
}

function OverviewMetrics() {
  const analytics = useEventAnalytics(30);
  return (
    <Box px={{ base: "5", md: "8" }} pb="5">
      <Heading size="md" mb="3">
        События за 30 дней
      </Heading>
      {analytics.isPending ?
        <Text role="status">Загружаем статистику…</Text>
      : analytics.isError ?
        <Flex gap="3" align="center">
          <Text role="alert">Статистика недоступна</Text>
          <Button size="sm" onClick={() => void analytics.refetch()}>
            Повторить
          </Button>
        </Flex>
      : <Grid
          templateColumns={{ base: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }}
          gap="3">
          {[
            ["Всего событий", analytics.data.total],
            ["Высокий риск", analytics.data.highRisk],
            ["Подтверждено", analytics.data.confirmed],
            ["Ложные тревоги", analytics.data.falsePositive],
          ].map(([label, value]) => (
            <Box
              key={label}
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="xl"
              p="5">
              <Text fontSize="2xl" fontWeight="800">
                {value}
              </Text>
              <Text color="gray.500" fontSize="sm">
                {label}
              </Text>
            </Box>
          ))}
        </Grid>
      }
    </Box>
  );
}

function DeviceCard({
  cameras,
  onCameraSelect,
  onWebcamRemove,
  webcamAdded = false,
}: {
  cameras: CameraSlot[];
  onCameraSelect: (camera: CameraSlot) => void;
  onWebcamRemove?: () => void;
  webcamAdded?: boolean;
}) {
  const [webcamWide, setWebcamWide] = useState(false);

  return (
    <Box
      mt="6"
      overflow="hidden"
      borderRadius="2xl"
      bg="whiteAlpha.800"
      boxShadow="lg"
      backdropFilter="blur(24px)">
      <Flex minH="66px" align="center" justify="space-between" p="4">
        <Heading size="md">Каналы и локальная камера</Heading>
        <Flex gap="1">
          <RoundButton label="Уведомления" small>
            <Bell size={20} />
          </RoundButton>
          <RoundButton label="Меню устройства" small>
            <MoreHorizontal size={23} />
          </RoundButton>
        </Flex>
      </Flex>
      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
        gap="4"
        p="4">
        {webcamAdded && (
          <Box
            gridColumn={{ base: "auto", md: webcamWide ? "1 / -1" : "auto" }}
            minW="0"
            overflow="hidden"
            border="2px solid"
            borderColor="blue.400"
            borderRadius="2xl"
            bg="white"
            boxShadow="md">
            <Flex
              align="center"
              justify="space-between"
              gap="3"
              borderBottom="1px solid"
              borderColor="gray.100"
              px="4"
              py="3">
              <Box>
                <Flex align="center" gap="2">
                  <Text
                    borderRadius="full"
                    bg="green.50"
                    color="green.700"
                    px="2.5"
                    py="1"
                    fontSize="xs"
                    fontWeight="800">
                    Local CV
                  </Text>
                  <Text color="blue.600" fontSize="xs" fontWeight="800">
                    WEB
                  </Text>
                </Flex>
                <Heading mt="1" size="sm">
                  Веб-камера
                </Heading>
              </Box>
              <Flex gap="1" wrap="wrap" justify="flex-end">
                <Button
                  size="sm"
                  variant="ghost"
                  color="blue.600"
                  onClick={() => setWebcamWide((current) => !current)}>
                  {webcamWide ?
                    <Minimize2 size={16} />
                  : <Maximize2 size={16} />}
                  {webcamWide ? "Компактно" : "Расширить"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  color="red.600"
                  onClick={onWebcamRemove}>
                  <X size={16} /> Удалить
                </Button>
              </Flex>
            </Flex>
            <Suspense
              fallback={
                <Flex minH="260px" align="center" justify="center">
                  <Text color="gray.500">Загрузка камеры…</Text>
                </Flex>
              }>
              <WebcamViewer autoStart />
            </Suspense>
          </Box>
        )}
        {webcamAdded && !webcamWide && (
          <Flex
            minH={{ base: "260px", md: "100%" }}
            direction="column"
            justify="space-between"
            gap="6"
            border="1px solid"
            borderColor="blue.100"
            borderRadius="2xl"
            bg="linear-gradient(145deg, rgba(239,246,255,.96), rgba(255,255,255,.92))"
            p={{ base: "5", lg: "6" }}>
            <Box>
              <Text
                color="blue.600"
                fontSize="xs"
                fontWeight="800"
                letterSpacing=".1em"
                textTransform="uppercase">
                Computer Vision
              </Text>
              <Heading mt="2" size="md">
                Локальный анализ в реальном времени
              </Heading>
              <Text mt="3" color="gray.600" fontSize="sm" lineHeight="1.7">
                MediaPipe отслеживает позу и кисти в браузере. YOLO анализирует
                отдельные кадры на сервере; непрерывная обработка IP-камер
                выполняется агентом магазина.
              </Text>
            </Box>
            <Grid templateColumns="repeat(3, minmax(0, 1fr))" gap="2">
              <VisionFact
                icon={<Hand size={18} />}
                value="21"
                label="точка кисти"
                color="purple.600"
                bg="purple.50"
              />
              <VisionFact
                icon={<Gauge size={18} />}
                value="YOLO"
                label="анализ кадров"
                color="green.700"
                bg="green.50"
              />
              <VisionFact
                icon={<ShieldCheck size={18} />}
                value="JWT"
                label="защищённый API"
                color="blue.600"
                bg="blue.50"
              />
            </Grid>
            <Box>
              <Text mb="2" color="gray.500" fontSize="xs" fontWeight="800">
                ЦВЕТА ПАЛЬЦЕВ
              </Text>
              <Flex gap="2" wrap="wrap">
                {["#fb923c", "#a3e635", "#22d3ee", "#c084fc", "#f472b6"].map(
                  (color) => (
                    <Box
                      key={color}
                      boxSize="3"
                      border="2px solid"
                      borderColor="gray.800"
                      borderRadius="full"
                      bg={color}
                    />
                  ),
                )}
              </Flex>
            </Box>
          </Flex>
        )}
        {cameras.map((camera) => (
          <CameraPreview
            key={camera.channel}
            camera={camera}
            onCameraSelect={onCameraSelect}
          />
        ))}
      </Grid>
      <Button variant="ghost" w="full" color="gray.500">
        Развернуть (всего {cameras.length + (webcamAdded ? 1 : 0)}){" "}
        <ChevronDown size={16} />
      </Button>
    </Box>
  );
}

function CameraPreview({
  camera,
  onCameraSelect,
}: {
  camera: CameraSlot;
  onCameraSelect: (camera: CameraSlot) => void;
}) {
  const runtime = useRuntimeConfig();
  const demo = runtime.data?.demoMode === true;
  return (
    <Box
      as="button"
      onClick={() => onCameraSelect(camera)}
      position="relative"
      minH={{ base: "190px", md: "300px" }}
      overflow="hidden"
      border="1px solid"
      borderColor="gray.300"
      borderRadius="2xl"
      bg="gray.800"
      backgroundImage={
        demo ?
          `linear-gradient(180deg, rgba(15,23,42,.04), rgba(15,23,42,.48)), url(${cameraPreview})`
        : undefined
      }
      backgroundSize="cover"
      backgroundPosition="center"
      color="white"
      cursor="pointer"
      p="4"
      textAlign="left"
      transition=".2s"
      _hover={{
        borderColor: "blue.400",
        transform: "translateY(-2px)",
        boxShadow: "lg",
      }}>
      <Text
        position="absolute"
        top="3"
        left="3"
        borderRadius="full"
        px="2.5"
        py="1"
        bg="green.50"
        color="green.700"
        fontSize="xs"
        fontWeight="800">
        {camera.status}
      </Text>
      <Text
        position="absolute"
        top="3"
        right="3"
        borderRadius="full"
        px="2.5"
        py="1"
        bg="blue.50"
        color="blue.600"
        fontSize="xs"
        fontWeight="800">
        {camera.channel}
      </Text>
      <Flex position="absolute" inset="0" align="center" justify="center">
        <Box textAlign="center">
          <ImageIcon size={28} />
          <Text mt="2" fontSize="xs">
            {demo ? "Демонстрационный кадр" : "Предпросмотр не подключён"}
          </Text>
        </Box>
      </Flex>
      {camera.status !== "Online" && (
        <Flex
          position="absolute"
          top="14"
          right="4"
          boxSize="12"
          align="center"
          justify="center"
          borderRadius="full"
          bg="blue.600/30">
          <Lock size={22} />
        </Flex>
      )}
      <Box position="absolute" insetInline="4" bottom="4">
        <Text fontWeight="800">{camera.name}</Text>
        <Text mt="1" color="whiteAlpha.800" fontSize="sm" fontWeight="600">
          {camera.stream} · {camera.fps} · {camera.recording}
        </Text>
      </Box>
    </Box>
  );
}

function VisionFact({
  bg,
  color,
  icon,
  label,
  value,
}: {
  bg: string;
  color: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Box minW="0" borderRadius="xl" bg={bg} p="3" color={color}>
      {icon}
      <Text mt="2" fontSize="lg" fontWeight="900" lineHeight="1">
        {value}
      </Text>
      <Text
        mt="1"
        color="gray.600"
        fontSize="10px"
        fontWeight="700"
        lineHeight="1.25">
        {label}
      </Text>
    </Box>
  );
}

function CameraModal({
  camera,
  onClose,
}: {
  camera: CameraSlot;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const facts = [
    ["Устройство", camera.device],
    ["Статус", camera.status],
    ["Stream", camera.stream],
    ["Bitrate", camera.bitrate],
    ["FPS", camera.fps],
    ["Запись", camera.recording],
  ];
  return (
    <Flex
      position="fixed"
      inset="0"
      zIndex="20"
      align="flex-end"
      justify="center"
      bg="blackAlpha.400"
      p="4"
      role="presentation"
      onClick={onClose}>
      <Box
        as="section"
        role="dialog"
        aria-modal="true"
        aria-label="Детали камеры"
        w="min(100%, 520px)"
        border="1px solid"
        borderColor="whiteAlpha.700"
        borderRadius="3xl"
        bg="whiteAlpha.950"
        boxShadow="2xl"
        backdropFilter="blur(28px)"
        p="5"
        onClick={(event) => event.stopPropagation()}>
        <Flex align="flex-start" justify="space-between">
          <Box>
            <Text color="blue.600" fontSize="xs" fontWeight="800">
              {camera.channel}
            </Text>
            <Heading mt="1" size="lg">
              {camera.name}
            </Heading>
          </Box>
          <RoundButton label="Закрыть" small onClick={onClose}>
            <X size={20} />
          </RoundButton>
        </Flex>
        <Grid as="dl" gap="3" mt="5">
          {facts.map(([term, value]) => (
            <Grid key={term} templateColumns="92px minmax(0,1fr)" gap="3">
              <Text as="dt" color="gray.500" fontSize="sm">
                {term}
              </Text>
              <Text as="dd" m="0" overflowWrap="anywhere" fontWeight="700">
                {value}
              </Text>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Flex>
  );
}

function TablePage({
  headers,
  rows,
  text,
  title,
}: {
  headers: string[];
  rows: string[][];
  text: string;
  title: string;
}) {
  return (
    <Panel>
      <SectionIntro title={title} text={text} />
      <Surface p="0" overflowX="auto">
        <Box as="table" w="full" minW="640px" borderCollapse="collapse">
          <Box as="thead">
            <Box as="tr">
              {headers.map((header) => (
                <Box
                  as="th"
                  key={header}
                  borderBottom="1px solid"
                  borderColor="gray.200"
                  p="4"
                  color="gray.500"
                  fontSize="xs"
                  textAlign="left"
                  textTransform="uppercase">
                  {header}
                </Box>
              ))}
            </Box>
          </Box>
          <Box as="tbody">
            {rows.map((row) => (
              <Box as="tr" key={row.join("-")}>
                {row.map((cell, index) => (
                  <Box
                    as="td"
                    key={`${cell}-${index}`}
                    borderBottom="1px solid"
                    borderColor="gray.200"
                    p="4"
                    fontWeight="600">
                    {cell}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      </Surface>
    </Panel>
  );
}

function ContentSection({
  children,
  text,
  title,
}: {
  children: React.ReactNode;
  text: string;
  title: string;
}) {
  return (
    <Box as="section" px={{ base: "5", md: "8" }} py="10">
      <SectionIntro title={title} text={text} />
      {children}
    </Box>
  );
}
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Box as="section" px={{ base: "5", md: "8" }} pb="10">
      {children}
    </Box>
  );
}
function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <Box my="4">
      <Heading as="h2" size="lg">
        {title}
      </Heading>
      <Text mt="2" color="gray.500">
        {text}
      </Text>
    </Box>
  );
}
function Surface({ children, ...props }: React.ComponentProps<typeof Box>) {
  return (
    <Box
      border="1px solid"
      borderColor="whiteAlpha.700"
      borderRadius="2xl"
      bg="whiteAlpha.800"
      boxShadow="md"
      backdropFilter="blur(22px)"
      p="5"
      {...props}>
      {children}
    </Box>
  );
}
function RoundButton({
  children,
  label,
  onClick,
  small = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  small?: boolean;
}) {
  return (
    <IconButton
      aria-label={label}
      variant="ghost"
      borderRadius="full"
      boxSize={small ? "36px" : "42px"}
      onClick={onClick}>
      {children}
    </IconButton>
  );
}
