import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Camera,
  MonitorPlay,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

export type ProductMetric = { value: string; label: string };
export type ArchitectureLayer = {
  title: string;
  description: string;
  stack: string[];
};
export type IncidentScenario = {
  title: string;
  description: string;
  priority: string;
};
export type RoadmapStage = { period: string; title: string; outcome: string };
export type PageId =
  | "overview"
  | "cameras"
  | "zones"
  | "incidents"
  | "pos"
  | "analytics"
  | "staff"
  | "settings";
export type NavigationItem = { id: PageId; label: string; icon: LucideIcon };
 
export const pagePaths = {
  overview: "/",
  cameras: "/cameras",
  zones: "/zones",
  incidents: "/incidents",
  pos: "/pos",
  analytics: "/analytics",
  staff: "/staff",
  settings: "/settings",
} as const satisfies Record<PageId, string>;

export const navigationItems: NavigationItem[] = [
  { id: "overview", label: "Обзор", icon: MonitorPlay },
  { id: "cameras", label: "Камеры", icon: Camera },
  { id: "zones", label: "Зоны", icon: ScanLine },
  { id: "incidents", label: "Инциденты", icon: ShieldCheck },
  { id: "pos", label: "POS-события", icon: ReceiptText },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "staff", label: "Сотрудники", icon: UsersRound },
  { id: "settings", label: "Настройки", icon: Settings },
];

export const productMetrics: ProductMetric[] = [
  { value: "3–5", label: "касс в первом пилоте" },
  { value: "30 дней", label: "рабочий режим проверки гипотезы" },
  { value: "<30 сек", label: "цель доставки события в панель" },
  { value: "95%+", label: "целевое время получения видео и POS-событий" },
];

export const architectureLayers: ArchitectureLayer[] = [
  {
    title: "Агент магазина",
    description:
      "Приём RTSP, выбор кадров, восстановление подключения и запись клипов. Браузерная webcam остаётся отдельным источником.",
    stack: ["OpenCV", "FFmpeg", "MediaPipe"],
  },
  {
    title: "Vision Service",
    description:
      "YOLO обнаруживает объекты, ByteTrack связывает их между кадрами. События формируются по переходам между размеченными зонами.",
    stack: ["FastAPI", "YOLO", "ByteTrack"],
  },
  {
    title: "Backend и события",
    description:
      "API сохраняет факты и очередь доставки одной транзакцией. Отдельный worker сопоставляет CV с POS и формирует объяснимую оценку риска.",
    stack: ["FastAPI", "PostgreSQL", "Redis"],
  },
  {
    title: "Product Layer",
    description:
      "Панель оператора, review flow, POS demo, настройки и аналитика поверх единого HTTP-контракта.",
    stack: ["React", "React Query", "MSW demo"],
  },
];

export const incidentScenarios: IncidentScenario[] = [
  {
    title: "Товар без сканирования",
    description:
      "Объект вошёл в BAG/CUSTOMER-зону, но в POS нет item_added в заданном временном окне.",
    priority: "High",
  },
  {
    title: "Отмена после передачи",
    description:
      "Товар передан покупателю, затем позиция удалена из чека, а физический возврат не найден.",
    priority: "High",
  },
  {
    title: "Ящик без операции",
    description:
      "Денежный ящик открыт без cash payment, refund или другого разрешённого POS-события.",
    priority: "High",
  },
];

export const roadmapStages: RoadmapStage[] = [
  {
    period: "Готово",
    title: "Продуктовый dashboard",
    outcome:
      "Фильтры магазина и кассы, клипы, POS-контекст и три решения оператора. Демо включается только явно.",
  },
  {
    period: "Готово",
    title: "Локальная webcam",
    outcome:
      "MediaPipe определяет позу и кисти, а браузер проверяет попадание точек в сохранённые зоны.",
  },
  {
    period: "Добавлено",
    title: "YOLO и tracking",
    outcome:
      "YOLO и ByteTrack выполняются отдельно от API. Качество классов товаров нужно проверять на размеченных видео магазина.",
  },
  {
    period: "Пилот",
    title: "Камера и POS магазина",
    outcome:
      "Настройте RTSP на агенте и POS-адаптер, проверьте синхронизацию времени, доставку клипов и точность на реальных сценариях.",
  },
];
