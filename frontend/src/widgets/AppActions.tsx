import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Input,
  Text,
  Textarea,
} from "@chakra-ui/react";
import {
  Camera,
  Check,
  Clock3,
  FileChartColumn,
  History,
  Plus,
  ReceiptText,
  ScanLine,
  Search,
  Settings,
  ShieldAlert,
  UserPlus,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { PageId } from "../productContent";
import { useRuntimeConfig } from "../api/runtime";

type DialogId = "history" | "search" | "create" | null;
type Activity = { id: string; title: string; details: string; time: string };

const storageKey = "secure-guard-activity-v1";

const initialActivity: Activity[] = [
  {
    id: "initial-1",
    title: "Камера D01 подключена",
    details: "Касса 1 · Main 101",
    time: "Сегодня, 12:42",
  },
  {
    id: "initial-2",
    title: "Инцидент подтверждён",
    details: "Risk 86 · Товар без сканирования",
    time: "Сегодня, 12:18",
  },
  {
    id: "initial-3",
    title: "Настройки уведомлений обновлены",
    details: "Telegram · Критические события",
    time: "Вчера, 18:05",
  },
];

const searchItems: Array<{
  title: string;
  details: string;
  page: PageId;
  keywords: string;
}> = [
  {
    title: "Камера D01 · Касса 1",
    details: "Онлайн · 192.168.1.41",
    page: "cameras",
    keywords: "камера касса d01 online ip",
  },
  {
    title: "Камера D02 · Касса 2",
    details: "Требуется настройка",
    page: "cameras",
    keywords: "камера касса d02 setup",
  },
  {
    title: "Зоны контроля",
    details: "Кассовая зона, денежный ящик и сканер",
    page: "zones",
    keywords: "зоны касса ящик scanner roi разметка",
  },
  {
    title: "Товар без сканирования",
    details: "Инцидент · Risk 86",
    page: "incidents",
    keywords: "инцидент риск товар сканирование",
  },
  {
    title: "POS-события",
    details: "34 события сегодня",
    page: "pos",
    keywords: "pos касса платеж событие",
  },
  {
    title: "Аналитика качества",
    details: "Метрики пилота и детекции",
    page: "analytics",
    keywords: "аналитика отчет метрики",
  },
  {
    title: "Сотрудники и смены",
    details: "3 сотрудника в пилоте",
    page: "staff",
    keywords: "сотрудники персонал смена",
  },
  {
    title: "Настройки уведомлений",
    details: "Telegram и системные события",
    page: "settings",
    keywords: "настройки уведомления telegram",
  },
];

const createConfig: Record<
  PageId,
  {
    title: string;
    description: string;
    placeholder: string;
    success: string;
    icon: ReactNode;
  }
> = {
  overview: {
    title: "Быстрое действие",
    description: "Создайте новую сущность рабочего пространства.",
    placeholder: "Название или краткое описание",
    success: "Новое действие создано",
    icon: <Plus size={22} />,
  },
  cameras: {
    title: "Подключить камеру",
    description: "Добавьте камеру или канал регистратора.",
    placeholder: "Например, Касса 5",
    success: "Камера добавлена в очередь подключения",
    icon: <Camera size={22} />,
  },
  zones: {
    title: "Добавить зону",
    description: "Отметьте область контроля на кадре выбранной камеры.",
    placeholder: "Название зоны",
    success: "Зона подготовлена к разметке",
    icon: <ScanLine size={22} />,
  },
  incidents: {
    title: "Создать инцидент",
    description: "Зафиксируйте событие для ручной проверки.",
    placeholder: "Кратко опишите событие",
    success: "Инцидент создан",
    icon: <ShieldAlert size={22} />,
  },
  pos: {
    title: "Подключить POS",
    description: "Добавьте кассу или интеграцию с POS-системой.",
    placeholder: "Название кассы или интеграции",
    success: "POS-интеграция добавлена",
    icon: <ReceiptText size={22} />,
  },
  analytics: {
    title: "Создать отчёт",
    description: "Подготовьте новый аналитический отчёт.",
    placeholder: "Название отчёта",
    success: "Отчёт поставлен в очередь",
    icon: <FileChartColumn size={22} />,
  },
  staff: {
    title: "Добавить сотрудника",
    description: "Пригласите сотрудника в рабочее пространство.",
    placeholder: "Имя или рабочий e-mail",
    success: "Приглашение создано",
    icon: <UserPlus size={22} />,
  },
  settings: {
    title: "Добавить интеграцию",
    description: "Подключите новый сервис к SecureGuard.",
    placeholder: "Название интеграции",
    success: "Интеграция добавлена",
    icon: <Settings size={22} />,
  },
};

export function AppActions({
  activePage,
  cameraAdded,
  onCameraAdd,
  onNavigate,
  pageTitle,
}: {
  activePage: PageId;
  cameraAdded: boolean;
  onCameraAdd: () => void;
  onNavigate: (page: PageId) => void;
  pageTitle: string;
}) {
  const runtime = useRuntimeConfig();
  const demo = runtime.data?.demoMode === true;
  const [dialog, setDialog] = useState<DialogId>(null);
  const [query, setQuery] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDetails, setDraftDetails] = useState("");
  const [notice, setNotice] = useState("");
  const [activity, setActivity] = useState<Activity[]>(loadActivity);
  const config = createConfig[activePage];

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru");
    const items =
      demo ? searchItems : (
        [
          {
            title: "Камеры",
            details: "Камеры и веб-камера",
            page: "cameras" as const,
            keywords: "камера",
          },
          {
            title: "Зоны",
            details: "Разметка областей контроля",
            page: "zones" as const,
            keywords: "зоны",
          },
          {
            title: "Инциденты",
            details: "Очередь проверки",
            page: "incidents" as const,
            keywords: "инциденты",
          },
          {
            title: "POS-события",
            details: "Журнал операций",
            page: "pos" as const,
            keywords: "касса",
          },
          {
            title: "Настройки",
            details: "Рабочее пространство",
            page: "settings" as const,
            keywords: "настройки",
          },
        ]
      );
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.title} ${item.details} ${item.keywords}`
        .toLocaleLowerCase("ru")
        .includes(normalized),
    );
  }, [query, demo]);

  function closeDialog() {
    setDialog(null);
    setQuery("");
    setDraftTitle("");
    setDraftDetails("");
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function addActivity(title: string, details: string) {
    const item: Activity = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      details,
      time: new Intl.DateTimeFormat("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
    };
    setActivity((current) => {
      const next = [item, ...current].slice(0, 20);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Storage may be unavailable. */
      }
      return next;
    });
  }

  function openSearchResult(page: PageId, title: string) {
    if (demo) addActivity("Открыт результат поиска", title);
    closeDialog();
    onNavigate(page);
  }

  function createItem(event: FormEvent) {
    event.preventDefault();
    if (!demo) return;
    const title = draftTitle.trim();
    if (!title) return;
    addActivity(
      config.success,
      draftDetails.trim() ? `${title} · ${draftDetails.trim()}` : title,
    );
    closeDialog();
    showNotice(config.success);
  }

  return (
    <>
      <Flex gap="3" align="center" px={{ base: "5", md: "8" }} pt="6" pb="2">
        {demo && (
          <ActionButton
            label="История действий"
            onClick={() => setDialog("history")}>
            <History size={22} />
          </ActionButton>
        )}
        <ActionButton
          label="Глобальный поиск"
          onClick={() => setDialog("search")}>
          <Search size={22} />
        </ActionButton>
      </Flex>
      <Flex
        as="header"
        align="center"
        justify="space-between"
        px={{ base: "5", md: "8" }}
        py="4"
        pb="6">
        <Heading as="h1" size="xl">
          {pageTitle}
        </Heading>
        {activePage === "zones" ?
          null
        : activePage === "cameras" ?
          <Button
            disabled={cameraAdded}
            bg="blue.600"
            color="white"
            borderRadius="full"
            boxShadow="0 8px 20px rgba(37, 99, 235, .22)"
            _hover={{ bg: "blue.700" }}
            onClick={onCameraAdd}>
            <Plus size={19} />{" "}
            {cameraAdded ? "Веб-камера добавлена" : "Добавить камеру"}
          </Button>
        : demo ?
          <ActionButton
            label={config.title}
            primary
            onClick={() => setDialog("create")}>
            <Plus size={25} />
          </ActionButton>
        : null}
      </Flex>

      {dialog && (
        <DialogOverlay onClose={closeDialog}>
          {demo && dialog === "history" && (
            <HistoryDialog activity={activity} onClose={closeDialog} />
          )}
          {dialog === "search" && (
            <SearchDialog
              query={query}
              results={results}
              setQuery={setQuery}
              onClose={closeDialog}
              onOpen={openSearchResult}
            />
          )}
          {demo && dialog === "create" && (
            <CreateDialog
              config={config}
              draftTitle={draftTitle}
              draftDetails={draftDetails}
              setDraftTitle={setDraftTitle}
              setDraftDetails={setDraftDetails}
              onClose={closeDialog}
              onSubmit={createItem}
            />
          )}
        </DialogOverlay>
      )}

      {notice && (
        <Flex
          position="fixed"
          top="5"
          right="5"
          zIndex="40"
          align="center"
          gap="3"
          maxW="calc(100vw - 40px)"
          border="1px solid"
          borderColor="green.200"
          borderRadius="xl"
          bg="white"
          color="green.700"
          boxShadow="xl"
          px="4"
          py="3">
          <Flex
            boxSize="7"
            align="center"
            justify="center"
            borderRadius="full"
            bg="green.100">
            <Check size={16} />
          </Flex>
          <Text fontSize="sm" fontWeight="800">
            {notice}
          </Text>
        </Flex>
      )}
    </>
  );
}

function DialogOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <Flex
      position="fixed"
      inset="0"
      zIndex="30"
      align={{ base: "flex-end", sm: "center" }}
      justify="center"
      bg="blackAlpha.500"
      p={{ base: "3", sm: "5" }}
      onClick={onClose}>
      <Box
        role="dialog"
        aria-modal="true"
        w="min(100%, 620px)"
        maxH="min(760px, 90svh)"
        overflow="auto"
        border="1px solid"
        borderColor="whiteAlpha.700"
        borderRadius="3xl"
        bg="white"
        boxShadow="2xl"
        onClick={(event) => event.stopPropagation()}>
        {children}
      </Box>
    </Flex>
  );
}

function DialogHeader({
  children,
  description,
  onClose,
  title,
}: {
  children: ReactNode;
  description: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <>
      <Flex
        align="flex-start"
        gap="4"
        borderBottom="1px solid"
        borderColor="gray.100"
        px={{ base: "5", sm: "6" }}
        py="5">
        <Flex
          boxSize="11"
          flex="0 0 auto"
          align="center"
          justify="center"
          borderRadius="xl"
          bg="blue.50"
          color="blue.600">
          {children}
        </Flex>
        <Box flex="1">
          <Heading as="h2" size="lg">
            {title}
          </Heading>
          <Text mt="1" color="gray.500" fontSize="sm">
            {description}
          </Text>
        </Box>
        <IconButton
          aria-label="Закрыть"
          variant="ghost"
          borderRadius="full"
          onClick={onClose}>
          <X size={20} />
        </IconButton>
      </Flex>
    </>
  );
}

function HistoryDialog({
  activity,
  onClose,
}: {
  activity: Activity[];
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader
        title="История действий"
        description="Последние изменения и события рабочего пространства."
        onClose={onClose}>
        <Clock3 size={22} />
      </DialogHeader>
      <Box p={{ base: "4", sm: "6" }}>
        {activity.map((item, index) => (
          <Flex
            key={item.id}
            gap="4"
            position="relative"
            pb={index < activity.length - 1 ? "5" : "0"}>
            <Flex
              position="relative"
              zIndex="1"
              boxSize="9"
              flex="0 0 auto"
              align="center"
              justify="center"
              borderRadius="full"
              bg="blue.50"
              color="blue.600">
              <Check size={16} />
            </Flex>
            {index < activity.length - 1 && (
              <Box
                position="absolute"
                top="9"
                bottom="0"
                left="17px"
                w="1px"
                bg="gray.200"
              />
            )}
            <Box flex="1" pb="1">
              <Flex justify="space-between" gap="3">
                <Text fontWeight="800">{item.title}</Text>
                <Text flex="0 0 auto" color="gray.400" fontSize="xs">
                  {item.time}
                </Text>
              </Flex>
              <Text mt="1" color="gray.500" fontSize="sm">
                {item.details}
              </Text>
            </Box>
          </Flex>
        ))}
      </Box>
    </>
  );
}

function SearchDialog({
  onClose,
  onOpen,
  query,
  results,
  setQuery,
}: {
  onClose: () => void;
  onOpen: (page: PageId, title: string) => void;
  query: string;
  results: typeof searchItems;
  setQuery: (value: string) => void;
}) {
  return (
    <>
      <DialogHeader
        title="Глобальный поиск"
        description="Найдите камеру, инцидент, сотрудника или раздел."
        onClose={onClose}>
        <Search size={22} />
      </DialogHeader>
      <Box p={{ base: "4", sm: "6" }}>
        <Box position="relative">
          <Box
            position="absolute"
            left="4"
            top="50%"
            color="gray.400"
            transform="translateY(-50%)">
            <Search size={18} />
          </Box>
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Начните вводить название…"
            h="12"
            pl="11"
            borderRadius="xl"
          />
        </Box>
        <Text
          mt="5"
          mb="2"
          color="gray.500"
          fontSize="xs"
          fontWeight="800"
          textTransform="uppercase">
          {query ? `Найдено: ${results.length}` : "Быстрый доступ"}
        </Text>
        <Box>
          {results.map((item) => (
            <Button
              key={`${item.page}-${item.title}`}
              variant="ghost"
              w="full"
              h="auto"
              justifyContent="flex-start"
              gap="3"
              borderRadius="xl"
              px="3"
              py="3"
              textAlign="left"
              onClick={() => onOpen(item.page, item.title)}>
              <Flex
                boxSize="9"
                align="center"
                justify="center"
                borderRadius="lg"
                bg="gray.100"
                color="gray.600">
                <Search size={16} />
              </Flex>
              <Box flex="1">
                <Text fontWeight="800">{item.title}</Text>
                <Text mt="1" color="gray.500" fontSize="sm" fontWeight="500">
                  {item.details}
                </Text>
              </Box>
            </Button>
          ))}
          {results.length === 0 && (
            <Box py="10" textAlign="center">
              <Text fontWeight="800">Ничего не найдено</Text>
              <Text mt="1" color="gray.500" fontSize="sm">
                Попробуйте изменить запрос.
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
}

function CreateDialog({
  config,
  draftDetails,
  draftTitle,
  onClose,
  onSubmit,
  setDraftDetails,
  setDraftTitle,
}: {
  config: (typeof createConfig)[PageId];
  draftDetails: string;
  draftTitle: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  setDraftDetails: (value: string) => void;
  setDraftTitle: (value: string) => void;
}) {
  return (
    <Box as="form" onSubmit={onSubmit}>
      <DialogHeader
        title={config.title}
        description={config.description}
        onClose={onClose}>
        {config.icon}
      </DialogHeader>
      <Box p={{ base: "5", sm: "6" }}>
        <Text as="label" display="block" mb="2" fontSize="sm" fontWeight="800">
          Название
        </Text>
        <Input
          autoFocus
          required
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          placeholder={config.placeholder}
          h="12"
          borderRadius="xl"
        />
        <Text
          as="label"
          display="block"
          mt="5"
          mb="2"
          fontSize="sm"
          fontWeight="800">
          Комментарий{" "}
          <Text as="span" color="gray.400" fontWeight="500">
            (необязательно)
          </Text>
        </Text>
        <Textarea
          value={draftDetails}
          onChange={(event) => setDraftDetails(event.target.value)}
          placeholder="Добавьте детали для команды"
          minH="110px"
          borderRadius="xl"
          resize="vertical"
        />
      </Box>
      <Flex
        justify="flex-end"
        gap="3"
        borderTop="1px solid"
        borderColor="gray.100"
        bg="gray.50"
        px={{ base: "5", sm: "6" }}
        py="4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button
          type="submit"
          bg="blue.600"
          color="white"
          _hover={{ bg: "blue.700" }}>
          <Plus size={18} /> Создать
        </Button>
      </Flex>
    </Box>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  primary = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <IconButton
      aria-label={label}
      title={label}
      variant={primary ? "solid" : "ghost"}
      borderRadius="full"
      boxSize="42px"
      bg={primary ? "blue.600" : "transparent"}
      color={primary ? "white" : "gray.800"}
      boxShadow={primary ? "0 8px 20px rgba(37, 99, 235, .22)" : "none"}
      _hover={{ bg: primary ? "blue.700" : "whiteAlpha.800" }}
      onClick={onClick}>
      {children}
    </IconButton>
  );
}

function loadActivity(): Activity[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as Activity[]) : initialActivity;
  } catch {
    return initialActivity;
  }
}
