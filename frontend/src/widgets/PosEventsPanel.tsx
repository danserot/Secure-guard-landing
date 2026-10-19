import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Input,
  Spinner,
  Text,
  chakra,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  Database,
  FlaskConical,
  ReceiptText,
  RefreshCw,
  Search,
  Server,
  ShoppingBag,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  useCreatePosEvent,
  usePosEvents,
  useRetryPosEvent,
  useSynchronizePosEvents,
} from "../api/queries";
import { useRuntimeConfig } from "../api/runtime";
import {
  formatMoney,
  formatTime,
  posEventTypeLabels,
  posStatusLabels,
} from "../domain/formatters";
import type { PosEvent, PosEventStatus, PosEventType } from "../domain/models";

type FilterId = "all" | "matched" | "pending" | "error";

const filters: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "Все события" },
  { id: "matched", label: "Сопоставлено" },
  { id: "pending", label: "Ожидают видео" },
  { id: "error", label: "Ошибки" },
];

const generatorSchema = z.object({
  type: z.enum([
    "item_added",
    "item_removed",
    "payment_completed",
    "drawer_opened",
    "refund_completed",
  ]),
  registerId: z.enum(["POS01", "POS02", "POS03"]),
  amount: z.string(),
  sku: z.string(),
  authorizedReason: z.string(),
});
type GeneratorForm = z.infer<typeof generatorSchema>;
const emptyEvents: PosEvent[] = [];

export function PosEventsPanel() {
  const runtime = useRuntimeConfig();
  const demo = runtime.data?.demoMode === true;
  const [page, setPage] = useState(0);
  const eventsQuery = usePosEvents({ limit: 50, offset: page * 50 });
  const retryMutation = useRetryPosEvent();
  const syncMutation = useSynchronizePosEvents();
  const createMutation = useCreatePosEvent();
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const events = eventsQuery.data ?? emptyEvents;
  const selected = events.find((event) => event.id === selectedId) ?? null;

  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru");
    return events.filter((event) => {
      const matchesQuery =
        !normalized ||
        `${event.id} ${event.type} ${event.title} ${event.registerName} ${event.transactionId}`
          .toLocaleLowerCase("ru")
          .includes(normalized);
      const matchesFilter =
        filter === "all" ||
        (filter === "matched" && event.status === "matched") ||
        (filter === "pending" && event.status === "pending_video") ||
        (filter === "error" && event.status === "error");
      return matchesQuery && matchesFilter;
    });
  }, [events, filter, query]);

  async function synchronize() {
    await syncMutation.mutateAsync();
    setNotice(
      "Синхронизация завершена: ожидающие события повторно сопоставлены",
    );
  }

  async function retry(id: string) {
    await retryMutation.mutateAsync(id);
    setNotice(`${id}: видео успешно сопоставлено`);
  }

  async function createEvent(values: GeneratorForm) {
    const result = await createMutation.mutateAsync({
      type: values.type,
      registerId: values.registerId,
      amount: values.amount ? Number(values.amount) : null,
      sku: values.sku || undefined,
      authorizedReason: values.authorizedReason || undefined,
    });
    setGeneratorOpen(false);
    setNotice(
      result.createdIncidentId ?
        `Создано событие ${result.event.id} и инцидент ${result.createdIncidentId}`
      : `Событие ${result.event.id} принято без создания инцидента`,
    );
  }

  const matched = events.filter((event) => event.status === "matched").length;
  const pending = events.filter(
    (event) => event.status === "pending_video",
  ).length;
  const errors = events.filter((event) => event.status === "error").length;

  return (
    <Box px={{ base: "5", md: "8" }} pb="12">
      <Flex
        align={{ base: "flex-start", xl: "center" }}
        justify="space-between"
        gap="4"
        mb="6"
        direction={{ base: "column", xl: "row" }}>
        <Box>
          <Heading as="h2" size="xl">
            Поток POS-событий
          </Heading>
          <Text mt="2" color="gray.500">
            Проверяйте нормализованные операции и их связь с видеопотоком.
          </Text>
        </Box>
        {demo && (
          <Flex gap="2" wrap="wrap">
            <Button
              variant="outline"
              bg="white"
              loading={syncMutation.isPending}
              onClick={synchronize}>
              <RefreshCw size={17} /> Синхронизировать
            </Button>
            <Button
              bg="blue.600"
              color="white"
              _hover={{ bg: "blue.700" }}
              onClick={() => setGeneratorOpen(true)}>
              <FlaskConical size={17} /> Генератор событий
            </Button>
          </Flex>
        )}
      </Flex>

      {(notice || syncMutation.error || createMutation.error) && (
        <Flex
          mb="5"
          align="center"
          justify="space-between"
          gap="3"
          border="1px solid"
          borderColor={
            syncMutation.error || createMutation.error ? "red.200" : "green.200"
          }
          borderRadius="xl"
          bg={
            syncMutation.error || createMutation.error ? "red.50" : "green.50"
          }
          color={
            syncMutation.error || createMutation.error ? "red.700" : "green.700"
          }
          px="4"
          py="3"
          fontSize="sm"
          fontWeight="700">
          <Text>
            {syncMutation.error?.message ||
              createMutation.error?.message ||
              notice}
          </Text>
          {notice.includes("инцидент") && (
            <chakra.a href="/incidents" textDecoration="underline">
              Открыть центр проверки
            </chakra.a>
          )}
        </Flex>
      )}

      <Grid
        templateColumns={{ base: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }}
        gap="3"
        mb="5">
        <Metric
          icon={<Database size={19} />}
          value={String(events.length)}
          label="событий на странице"
          color="blue"
        />
        <Metric
          icon={<Check size={19} />}
          value={String(matched)}
          label="сопоставлено"
          color="green"
        />
        <Metric
          icon={<Clock3 size={19} />}
          value={String(pending)}
          label="ожидают видео"
          color="orange"
        />
        <Metric
          icon={<AlertCircle size={19} />}
          value={String(errors)}
          label="требуют внимания"
          color="purple"
        />
      </Grid>

      <Grid
        templateColumns={{ base: "1fr", xl: "minmax(0, 1fr) 300px" }}
        gap="5"
        alignItems="start">
        <Box
          border="1px solid"
          borderColor="gray.200"
          borderRadius="2xl"
          bg="white"
          boxShadow="0 12px 36px rgba(15,23,42,.06)"
          overflow="hidden">
          <Flex
            direction={{ base: "column", lg: "row" }}
            align={{ lg: "center" }}
            justify="space-between"
            gap="3"
            borderBottom="1px solid"
            borderColor="gray.200"
            p="4">
            <Flex gap="1" overflowX="auto">
              {filters.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  flex="0 0 auto"
                  variant="ghost"
                  bg={filter === item.id ? "blue.50" : "transparent"}
                  color={filter === item.id ? "blue.700" : "gray.600"}
                  onClick={() => setFilter(item.id)}>
                  {item.label}
                </Button>
              ))}
            </Flex>
            <Box position="relative" w={{ base: "full", lg: "290px" }}>
              <Box
                position="absolute"
                left="3"
                top="50%"
                zIndex="1"
                color="gray.400"
                transform="translateY(-50%)">
                <Search size={17} />
              </Box>
              <Input
                aria-label="Поиск POS-событий"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ID, тип, транзакция…"
                h="10"
                pl="10"
              />
            </Box>
          </Flex>
          <Box
            display={{ base: "none", lg: "grid" }}
            gridTemplateColumns="100px minmax(240px, 1.4fr) 120px 100px 140px 32px"
            gap="3"
            bg="gray.50"
            px="5"
            py="3"
            color="gray.500"
            fontSize="xs"
            fontWeight="800"
            textTransform="uppercase">
            <Text>Время</Text>
            <Text>Событие</Text>
            <Text>Касса</Text>
            <Text>Сумма</Text>
            <Text>Статус</Text>
            <Text />
          </Box>
          {eventsQuery.isLoading && (
            <Flex
              minH="240px"
              align="center"
              justify="center"
              direction="column"
              gap="3">
              <Spinner color="blue.500" />
              <Text color="gray.500">Загружаем события…</Text>
            </Flex>
          )}
          {eventsQuery.isError && (
            <Flex
              minH="240px"
              align="center"
              justify="center"
              direction="column"
              gap="3">
              <Text fontWeight="800">Не удалось загрузить журнал</Text>
              <Button size="sm" onClick={() => eventsQuery.refetch()}>
                Повторить
              </Button>
            </Flex>
          )}
          {!eventsQuery.isLoading &&
            !eventsQuery.isError &&
            visibleEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onOpen={() => setSelectedId(event.id)}
              />
            ))}
          {!eventsQuery.isLoading &&
            !eventsQuery.isError &&
            visibleEvents.length === 0 && (
              <Box py="14" textAlign="center">
                <Text fontWeight="800">События не найдены</Text>
                <Text mt="1" color="gray.500" fontSize="sm">
                  Измените фильтр или поисковый запрос.
                </Text>
              </Box>
            )}
        </Box>

        <IntegrationStatus
          demo={demo}
          source={runtime.data?.dataSource}
          posIntegration={runtime.data?.posIntegration}
        />
      </Grid>
      <Flex gap="3" align="center" wrap="wrap" mt="4">
        <Text color="gray.500" fontSize="sm">
          Страница {page + 1} · поиск и счётчики по текущей странице
        </Text>
        <Button
          size="sm"
          variant="outline"
          disabled={page === 0 || eventsQuery.isFetching}
          onClick={() => {
            setPage((value) => value - 1);
            setSelectedId(null);
          }}>
          Назад
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={events.length < 50 || eventsQuery.isFetching}
          onClick={() => {
            setPage((value) => value + 1);
            setSelectedId(null);
          }}>
          Далее
        </Button>
      </Flex>

      {selected && (
        <EventDetails
          event={selected}
          busy={retryMutation.isPending}
          canRetry={demo}
          onClose={() => setSelectedId(null)}
          onRetry={retry}
        />
      )}
      {demo && generatorOpen && (
        <PosGenerator
          busy={createMutation.isPending}
          error={createMutation.error?.message ?? ""}
          onClose={() => setGeneratorOpen(false)}
          onSubmit={createEvent}
        />
      )}
    </Box>
  );
}

function IntegrationStatus({
  demo,
  source,
  posIntegration,
}: {
  demo: boolean;
  source?: "postgresql" | "browser";
  posIntegration?: string;
}) {
  return (
    <Box
      border="1px solid"
      borderColor="gray.200"
      borderRadius="2xl"
      bg="white"
      p="5">
      <Heading size="md">Состояние интеграции</Heading>
      <Text mt="2" mb="5" color="gray.500" fontSize="sm">
        {demo ?
          "Демонстрационный POS Gateway"
        : posIntegration === "rest_adapter" ?
          "Приём операций через POS-адаптер. Наличие API не подтверждает подключение конкретной кассы."
        : "POS-адаптер не настроен"}
      </Text>
      <SystemRow
        icon={<Server size={17} />}
        label="Хранилище"
        value={
          source === "browser" ? "Локальное демо"
          : source === "postgresql" ?
            "PostgreSQL"
          : "Недоступно"
        }
        positive={Boolean(source)}
      />
      {demo && (
        <Text mt="4" color="orange.700" fontSize="sm">
          Генератор и сопоставление моделируют события. Результаты не
          подтверждают реальные операции или наличие видео.
        </Text>
      )}
    </Box>
  );
}

function PosGenerator({
  busy,
  error,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: GeneratorForm) => Promise<void>;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GeneratorForm>({
    resolver: zodResolver(generatorSchema),
    defaultValues: {
      type: "drawer_opened",
      registerId: "POS01",
      amount: "",
      sku: "",
      authorizedReason: "",
    },
  });
  const type = useWatch({ control, name: "type" }) as PosEventType;
  return (
    <Flex
      position="fixed"
      inset="0"
      zIndex="40"
      align="center"
      justify="center"
      bg="blackAlpha.500"
      p="4"
      onClick={onClose}>
      <Box
        as="form"
        role="dialog"
        aria-modal="true"
        aria-label="Генератор POS-событий"
        w="min(100%, 560px)"
        borderRadius="2xl"
        bg="white"
        boxShadow="2xl"
        onSubmit={handleSubmit(onSubmit)}
        onClick={(event) => event.stopPropagation()}>
        <Flex
          align="flex-start"
          borderBottom="1px solid"
          borderColor="gray.200"
          p="5">
          <Flex
            boxSize="10"
            align="center"
            justify="center"
            borderRadius="xl"
            bg="blue.50"
            color="blue.600">
            <FlaskConical size={19} />
          </Flex>
          <Box flex="1" ml="3">
            <Heading size="md">Генератор POS-событий</Heading>
            <Text mt="1" color="gray.500" fontSize="sm">
              Проверьте полный поток без реальной кассы.
            </Text>
          </Box>
          <Button
            variant="ghost"
            minW="9"
            px="0"
            aria-label="Закрыть"
            onClick={onClose}>
            <X size={19} />
          </Button>
        </Flex>
        <Grid p="5" gap="4">
          <Field label="Тип события">
            <chakra.select
              {...register("type")}
              h="10"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              px="3">
              {generatorSchema.shape.type.options.map((value) => (
                <option key={value} value={value}>
                  {posEventTypeLabels[value]}
                </option>
              ))}
            </chakra.select>
          </Field>
          <Field label="Касса">
            <chakra.select
              {...register("registerId")}
              h="10"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              px="3">
              <option value="POS01">Касса 1 · POS01</option>
              <option value="POS02">Касса 2 · POS02</option>
              <option value="POS03">Касса 3 · POS03</option>
            </chakra.select>
          </Field>
          <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }} gap="4">
            <Field label="Сумма, ₽">
              <Input
                type="number"
                min="0"
                placeholder="Например, 1490"
                {...register("amount")}
              />
            </Field>
            <Field label="SKU товара">
              <Input placeholder="4607012345678" {...register("sku")} />
            </Field>
          </Grid>
          {type === "drawer_opened" && (
            <Field label="Разрешающая причина (необязательно)">
              <Input
                placeholder="Оставьте пустым для создания инцидента"
                {...register("authorizedReason")}
              />
            </Field>
          )}
          <Box
            borderRadius="xl"
            bg={
              type === "drawer_opened" || type === "item_removed" ?
                "orange.50"
              : "green.50"
            }
            p="4">
            <Text
              color={
                type === "drawer_opened" || type === "item_removed" ?
                  "orange.800"
                : "green.800"
              }
              fontSize="sm"
              fontWeight="800">
              {type === "drawer_opened" ?
                "Без разрешающей причины будет создан инцидент риска 86."
              : type === "item_removed" ?
                "Будет смоделирована передача товара и создан инцидент."
              : "Операция будет сопоставлена без создания инцидента."}
            </Text>
          </Box>
          {(error || Object.keys(errors).length > 0) && (
            <Text color="red.600" fontSize="sm">
              {error || "Проверьте заполненные поля"}
            </Text>
          )}
        </Grid>
        <Flex
          justify="flex-end"
          gap="3"
          borderTop="1px solid"
          borderColor="gray.200"
          p="5">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" bg="blue.600" color="white" loading={busy}>
            <FlaskConical size={17} /> Создать событие
          </Button>
        </Flex>
      </Box>
    </Flex>
  );
}

function EventRow({ event, onOpen }: { event: PosEvent; onOpen: () => void }) {
  return (
    <Box
      as="button"
      w="full"
      borderTop="1px solid"
      borderColor="gray.100"
      bg="white"
      px="5"
      py="4"
      textAlign="left"
      _hover={{ bg: "blue.50/40" }}
      onClick={onOpen}>
      <Grid
        display={{ base: "grid", lg: "none" }}
        templateColumns="auto 1fr auto"
        gap="3">
        <EventIcon type={event.type} />
        <Box>
          <Text fontWeight="800">{event.title}</Text>
          <Text mt="1" color="gray.500" fontSize="sm">
            {event.registerName} · {formatTime(event.occurredAt)} ·{" "}
            {formatMoney(event.amount)}
          </Text>
          <Box mt="2">
            <Status status={event.status} />
          </Box>
        </Box>
        <ChevronRight size={18} />
      </Grid>
      <Grid
        display={{ base: "none", lg: "grid" }}
        gridTemplateColumns="100px minmax(240px, 1.4fr) 120px 100px 140px 32px"
        gap="3"
        alignItems="center">
        <Text fontWeight="800">{formatTime(event.occurredAt)}</Text>
        <Flex align="center" gap="3">
          <EventIcon type={event.type} />
          <Box>
            <Text fontWeight="800">{event.title}</Text>
            <Text mt="1" color="gray.400" fontSize="xs">
              {event.id} · {event.type}
            </Text>
          </Box>
        </Flex>
        <Text fontWeight="700">{event.registerName}</Text>
        <Text fontWeight="800">{formatMoney(event.amount)}</Text>
        <Status status={event.status} />
        <ChevronRight size={17} />
      </Grid>
    </Box>
  );
}
function EventDetails({
  busy,
  canRetry,
  event,
  onClose,
  onRetry,
}: {
  busy: boolean;
  canRetry: boolean;
  event: PosEvent;
  onClose: () => void;
  onRetry: (id: string) => Promise<void>;
}) {
  const facts = [
    ["Касса", `${event.registerName} · ${event.registerId}`],
    ["Транзакция", event.transactionId],
    ["Сумма", formatMoney(event.amount)],
    [
      "Смещение видео",
      event.videoOffsetMs === null ? "Не найдено" : `${event.videoOffsetMs} мс`,
    ],
  ];
  return (
    <Flex
      position="fixed"
      inset="0"
      zIndex="30"
      justify="flex-end"
      bg="blackAlpha.500"
      onClick={onClose}>
      <Box
        role="dialog"
        aria-modal="true"
        aria-label="Детали POS-события"
        w="min(100%, 560px)"
        h="100svh"
        overflowY="auto"
        bg="white"
        boxShadow="-20px 0 60px rgba(15,23,42,.18)"
        onClick={(eventClick) => eventClick.stopPropagation()}>
        <Flex
          align="flex-start"
          borderBottom="1px solid"
          borderColor="gray.200"
          p="6">
          <EventIcon type={event.type} />
          <Box flex="1" ml="3">
            <Text color="gray.400" fontSize="xs" fontWeight="800">
              {event.id} · {formatTime(event.occurredAt)}
            </Text>
            <Heading mt="1" size="lg">
              {event.title}
            </Heading>
          </Box>
          <Button
            variant="ghost"
            minW="10"
            px="0"
            aria-label="Закрыть"
            onClick={onClose}>
            <X size={20} />
          </Button>
        </Flex>
        <Box p="6">
          <Status status={event.status} />
          <Heading mt="7" size="md">
            Детали операции
          </Heading>
          <Grid mt="4" templateColumns="repeat(2, 1fr)" gap="3">
            {facts.map(([label, value]) => (
              <Box key={label} borderRadius="xl" bg="gray.50" p="4">
                <Text color="gray.500" fontSize="xs">
                  {label}
                </Text>
                <Text
                  mt="2"
                  overflowWrap="anywhere"
                  fontSize="sm"
                  fontWeight="800">
                  {value}
                </Text>
              </Box>
            ))}
          </Grid>
          <Heading mt="7" size="md">
            Нормализованные данные
          </Heading>
          <Box
            mt="4"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            p="4">
            <Text fontWeight="800">{event.details}</Text>
            <Text mt="2" color="gray.500" fontSize="sm">
              Тип: {event.type} · POS Gateway
            </Text>
          </Box>
        </Box>
        {canRetry && (
          <Flex
            position="sticky"
            bottom="0"
            borderTop="1px solid"
            borderColor="gray.200"
            bg="whiteAlpha.950"
            p="5">
            <Button
              w="full"
              bg="blue.600"
              color="white"
              loading={busy}
              onClick={() => onRetry(event.id)}>
              <RefreshCw size={17} /> Повторить сопоставление
            </Button>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}
function EventIcon({ type }: { type: PosEventType }) {
  const icon =
    type.includes("payment") || type.includes("refund") ?
      <CreditCard size={17} />
    : type.includes("item") ? <ShoppingBag size={17} />
    : <ReceiptText size={17} />;
  return (
    <Flex
      boxSize="9"
      flex="0 0 auto"
      align="center"
      justify="center"
      borderRadius="lg"
      bg="blue.50"
      color="blue.600">
      {icon}
    </Flex>
  );
}
function Status({ status }: { status: PosEventStatus }) {
  const colors: Record<PosEventStatus, [string, string]> = {
    matched: ["green.50", "green.700"],
    pending_video: ["orange.50", "orange.700"],
    error: ["red.50", "red.700"],
    ignored: ["gray.100", "gray.600"],
  };
  return (
    <Text
      display="inline-flex"
      borderRadius="full"
      bg={colors[status][0]}
      color={colors[status][1]}
      px="3"
      py="1.5"
      fontSize="xs"
      fontWeight="800">
      {posStatusLabels[status]}
    </Text>
  );
}
function Metric({
  color,
  icon,
  label,
  value,
}: {
  color: "blue" | "green" | "purple" | "orange";
  icon: ReactNode;
  label: string;
  value: string;
}) {
  const palette = {
    blue: ["blue.50", "blue.600"],
    green: ["green.50", "green.600"],
    purple: ["purple.50", "purple.600"],
    orange: ["orange.50", "orange.600"],
  }[color];
  return (
    <Flex
      minH="112px"
      gap="4"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="2xl"
      bg="white"
      p={{ base: "4", md: "5" }}
      boxShadow="sm">
      <Flex
        boxSize="10"
        flex="0 0 auto"
        align="center"
        justify="center"
        borderRadius="xl"
        bg={palette[0]}
        color={palette[1]}>
        {icon}
      </Flex>
      <Box>
        <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="900">
          {value}
        </Text>
        <Text mt="2" color="gray.500" fontSize="sm">
          {label}
        </Text>
      </Box>
    </Flex>
  );
}
function SystemRow({
  icon,
  label,
  positive,
  value,
}: {
  icon: ReactNode;
  label: string;
  positive: boolean;
  value: string;
}) {
  return (
    <Flex align="center" gap="3">
      <Flex color="gray.500">{icon}</Flex>
      <Text flex="1" color="gray.600" fontSize="sm">
        {label}
      </Text>
      <Flex
        align="center"
        gap="1.5"
        color={positive ? "green.600" : "red.600"}
        fontSize="xs"
        fontWeight="800">
        <Box boxSize="1.5" borderRadius="full" bg="currentColor" />
        {value}
      </Flex>
    </Flex>
  );
}
function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Grid gap="2">
      <Text color="gray.700" fontSize="sm" fontWeight="700">
        {label}
      </Text>
      {children}
    </Grid>
  );
}
