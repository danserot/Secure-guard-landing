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
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  MessageSquareText,
  ReceiptText,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useCameraConfigs,
  useCurrentUser,
  useIncident,
  useIncidents,
  useStores,
  useTerminals,
  useUpdateIncident,
} from "../api/queries";
import { EvidenceVideo } from "./EvidenceVideo";
import { summarizeIncidents } from "../domain/analytics";
import {
  formatDate,
  formatTime,
  incidentStatusLabels,
  posEventTypeLabels,
} from "../domain/formatters";
import type {
  Incident,
  IncidentPatch,
  IncidentStatus,
  ReviewDecision,
} from "../domain/models";

type FilterId = "all" | "review" | "critical" | "confirmed";

const filters: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "Все" },
  { id: "review", label: "На проверке" },
  { id: "critical", label: "Критические" },
  { id: "confirmed", label: "Подтверждённые" },
];

const emptyIncidents: Incident[] = [];
const pageSize = 50;

export function IncidentsPanel() {
  const updateIncident = useUpdateIncident();
  const cameras = useCameraConfigs();
  const stores = useStores();
  const terminals = useTerminals();
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cameraFilter, setCameraFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [terminalFilter, setTerminalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const [riskFilter, setRiskFilter] = useState(0);
  const incidentsQuery = useIncidents({
    camera_id: cameraFilter || undefined,
    store_id: storeFilter || undefined,
    terminal_id: terminalFilter || undefined,
    status:
      statusFilter ||
      (filter === "confirmed" ? "confirmed"
      : filter === "review" ? "review"
      : undefined),
    min_risk: filter === "critical" ? Math.max(80, riskFilter) : riskFilter,
    from: fromDate ? new Date(fromDate).toISOString() : undefined,
    to: toDate ? new Date(toDate).toISOString() : undefined,
    limit: pageSize,
    offset: page * pageSize,
  });
  const incidents = incidentsQuery.data ?? emptyIncidents;
  const selectedQuery = useIncident(selectedId);

  const visibleIncidents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru");
    return incidents.filter((incident) => {
      const matchesQuery =
        !normalized ||
        `${incident.id} ${incident.title} ${incident.cameraName} ${incident.assignee ?? ""}`
          .toLocaleLowerCase("ru")
          .includes(normalized);
      const matchesFilter =
        filter === "all" ||
        (filter === "review" &&
          ["review", "awaiting_pos"].includes(incident.status)) ||
        (filter === "critical" && incident.riskScore >= 80) ||
        (filter === "confirmed" && incident.status === "confirmed");
      return matchesQuery && matchesFilter;
    });
  }, [filter, incidents, query]);

  const selected =
    selectedQuery.data ??
    incidents.find((incident) => incident.id === selectedId) ??
    null;
  const reviewCount = incidents.filter((item) =>
    ["review", "awaiting_pos"].includes(item.status),
  ).length;
  const criticalCount = incidents.filter(
    (item) => item.riskScore >= 80 && item.status !== "false_positive",
  ).length;
  const confirmedCount = incidents.filter(
    (item) => item.status === "confirmed",
  ).length;

  function resetFilters() {
    setCameraFilter("");
    setRiskFilter(0);
    setQuery("");
    setFilter("all");
    setStoreFilter("");
    setTerminalFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setPage(0);
  }

  function nextIncident() {
    if (!selectedId || visibleIncidents.length < 2) return setSelectedId(null);
    const currentIndex = visibleIncidents.findIndex(
      (item) => item.id === selectedId,
    );
    setSelectedId(
      visibleIncidents[(currentIndex + 1) % visibleIncidents.length]?.id ??
        null,
    );
  }

  return (
    <Box px={{ base: "5", md: "8" }} pb="12">
      <Flex
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        gap="4"
        mb="6"
        direction={{ base: "column", md: "row" }}>
        <Box>
          <Heading as="h2" size="xl">
            Центр проверки
          </Heading>
          <Text mt="2" color="gray.500">
            Проверяйте видео и POS-контекст, фиксируйте решение. Оценка риска не
            доказывает нарушение.
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
          fontWeight="700">
          <Box boxSize="2" borderRadius="full" bg="green.500" /> Решения
          сохраняются в текущем режиме
        </Flex>
      </Flex>

      <Text mb="2" color="gray.500" fontSize="xs">
        На текущей странице результатов
      </Text>
      <Grid
        templateColumns={{ base: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }}
        gap="3"
        mb="5">
        <SummaryCard
          icon={<Clock3 size={19} />}
          value={String(reviewCount)}
          label="требуют проверки"
          color="orange"
        />
        <SummaryCard
          icon={<ShieldAlert size={19} />}
          value={String(criticalCount)}
          label="критический риск"
          color="red"
        />
        <SummaryCard
          icon={<CheckCircle2 size={19} />}
          value={String(confirmedCount)}
          label="подтверждено"
          color="green"
        />
        <SummaryCard
          icon={<Clock3 size={19} />}
          value={String(
            summarizeIncidents(incidents, 36500, "").meanReviewSeconds ?? "—",
          )}
          label="время до решения, с"
          color="blue"
        />
      </Grid>

      <Box
        border="1px solid"
        borderColor="gray.200"
        borderRadius="2xl"
        bg="white"
        boxShadow="0 12px 36px rgba(15, 23, 42, .06)"
        overflow="hidden">
        <Flex
          direction={{ base: "column", xl: "row" }}
          align={{ xl: "center" }}
          justify="space-between"
          gap="4"
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
                onClick={() => {
                  setFilter(item.id);
                  setStatusFilter("");
                  setPage(0);
                }}>
                {item.label}
              </Button>
            ))}
          </Flex>
          <Flex gap="2" w={{ base: "full", xl: "380px" }}>
            <Box position="relative" flex="1">
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
                aria-label="Поиск инцидентов"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ID, событие, камера…"
                h="10"
                pl="10"
              />
            </Box>
            <Button
              variant="outline"
              px="3"
              aria-label="Дополнительные фильтры"
              aria-expanded={showAdvanced}
              bg={showAdvanced ? "blue.50" : "white"}
              onClick={() => setShowAdvanced((value) => !value)}>
              <Filter size={17} />
            </Button>
          </Flex>
        </Flex>

        {showAdvanced && (
          <Flex
            wrap="wrap"
            gap="4"
            align="center"
            borderBottom="1px solid"
            borderColor="gray.200"
            bg="gray.50"
            px="4"
            py="3">
            <FilterGroup label="Магазин">
              <FilterSelect
                label="Магазин"
                value={storeFilter}
                onChange={(value) => {
                  setStoreFilter(value);
                  setTerminalFilter("");
                  setPage(0);
                }}>
                <option value="">Все магазины</option>
                {stores.data?.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </FilterSelect>
            </FilterGroup>
            <FilterGroup label="Касса">
              <FilterSelect
                label="Касса"
                value={terminalFilter}
                onChange={(value) => {
                  setTerminalFilter(value);
                  setPage(0);
                }}>
                <option value="">Все кассы</option>
                {terminals.data
                  ?.filter(
                    (terminal) =>
                      !storeFilter || terminal.store_id === storeFilter,
                  )
                  .map((terminal) => (
                    <option key={terminal.id} value={terminal.id}>
                      {terminal.name}
                    </option>
                  ))}
              </FilterSelect>
            </FilterGroup>
            <FilterGroup label="Камера">
              <FilterSelect
                label="Камера"
                value={cameraFilter}
                onChange={(value) => {
                  setCameraFilter(value);
                  setPage(0);
                }}>
                <option value="">Все камеры</option>
                {cameras.data?.map((camera) => (
                  <option key={camera.camera_id} value={camera.camera_id}>
                    {camera.name}
                  </option>
                ))}
              </FilterSelect>
            </FilterGroup>
            <FilterGroup label="Статус">
              <FilterSelect
                label="Статус"
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value as IncidentStatus | "");
                  setFilter("all");
                  setPage(0);
                }}>
                <option value="">Все статусы</option>
                {Object.entries(incidentStatusLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </FilterSelect>
            </FilterGroup>
            <FilterGroup label="Минимальный риск">
              {[
                [0, "Любой"],
                [60, "60+"],
                [80, "80+"],
              ].map(([risk, label]) => (
                <Button
                  key={risk}
                  size="xs"
                  variant="ghost"
                  bg={riskFilter === risk ? "white" : "transparent"}
                  color={riskFilter === risk ? "blue.700" : "gray.600"}
                  onClick={() => {
                    setRiskFilter(Number(risk));
                    setPage(0);
                  }}>
                  {label}
                </Button>
              ))}
            </FilterGroup>
            <FilterGroup label="С">
              <Input
                aria-label="Начало периода"
                type="datetime-local"
                w="auto"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setPage(0);
                }}
              />
            </FilterGroup>
            <FilterGroup label="По">
              <Input
                aria-label="Конец периода"
                type="datetime-local"
                w="auto"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setPage(0);
                }}
              />
            </FilterGroup>
            <Button
              size="xs"
              variant="ghost"
              ml={{ md: "auto" }}
              color="gray.500"
              onClick={resetFilters}>
              Сбросить
            </Button>
          </Flex>
        )}

        <Box
          display={{ base: "none", lg: "grid" }}
          gridTemplateColumns="82px minmax(260px, 1.6fr) minmax(150px, .8fr) 120px 140px 48px"
          gap="3"
          bg="gray.50"
          px="5"
          py="3"
          color="gray.500"
          fontSize="xs"
          fontWeight="800"
          textTransform="uppercase">
          <Text>Риск</Text>
          <Text>Событие</Text>
          <Text>Камера</Text>
          <Text>Время</Text>
          <Text>Статус</Text>
          <Text />
        </Box>
        {incidentsQuery.isLoading && <LoadingState />}
        {incidentsQuery.isError && (
          <ErrorState onRetry={() => incidentsQuery.refetch()} />
        )}
        {!incidentsQuery.isLoading &&
          !incidentsQuery.isError &&
          visibleIncidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              onOpen={() => setSelectedId(incident.id)}
            />
          ))}
        {!incidentsQuery.isLoading &&
          !incidentsQuery.isError &&
          visibleIncidents.length === 0 && <EmptyState />}
      </Box>

      <Flex
        mt="4"
        justify="space-between"
        align="center"
        gap="3"
        wrap="wrap"
        color="gray.500"
        fontSize="sm">
        <Text>
          Страница {page + 1} · показано {visibleIncidents.length} · поиск по
          текущей странице
        </Text>
        <Flex gap="2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0 || incidentsQuery.isFetching}
            onClick={() => setPage((value) => value - 1)}>
            Назад
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={incidents.length < pageSize || incidentsQuery.isFetching}
            onClick={() => setPage((value) => value + 1)}>
            Далее
          </Button>
        </Flex>
        <Text>
          {incidentsQuery.isError ?
            "Ошибка обновления"
          : incidentsQuery.isFetching ?
            "Обновляем…"
          : "Обновление каждые 10 секунд"}
        </Text>
      </Flex>
      {selected && (
        <IncidentReviewDrawer
          key={selected.id}
          incident={selected}
          busy={updateIncident.isPending}
          error={
            updateIncident.error?.message ?? selectedQuery.error?.message ?? ""
          }
          onClose={() => setSelectedId(null)}
          onNext={nextIncident}
          onUpdate={(patch) =>
            updateIncident.mutateAsync({ id: selected.id, patch })
          }
        />
      )}
    </Box>
  );
}

function IncidentReviewDrawer({
  busy,
  error,
  incident,
  onClose,
  onNext,
  onUpdate,
}: {
  busy: boolean;
  error: string;
  incident: Incident;
  onClose: () => void;
  onNext: () => void;
  onUpdate: (patch: IncidentPatch) => Promise<Incident>;
}) {
  const user = useCurrentUser();
  const canReview =
    !!user.data &&
    ["admin", "manager", "operator", "reviewer"].includes(user.data.role);
  const [assignee, setAssignee] = useState(incident.assignee ?? "");
  const [comment, setComment] = useState(incident.review?.comment ?? "");
  const [seekSeconds, setSeekSeconds] = useState<number>();
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  async function saveAssignment() {
    try {
      await onUpdate({ assignee: assignee.trim() || null });
      setSavedMessage("Ответственный сохранён");
    } catch {
      /* Mutation error is displayed in the form. */
    }
  }

  async function submitReview(decision: ReviewDecision) {
    if (comment.trim().length < 3)
      return setSavedMessage("Добавьте комментарий к решению");
    try {
      await onUpdate({
        assignee: assignee.trim() || null,
        review: {
          decision,
          comment: comment.trim(),
          reviewer: user.data?.email ?? "Текущий оператор",
        },
      });
      onNext();
    } catch {
      /* Keep the comment and show the mutation error for retry. */
    }
  }

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
        aria-label="Проверка инцидента"
        w="min(100%, 720px)"
        h="100svh"
        overflowY="auto"
        bg="white"
        boxShadow="-20px 0 60px rgba(15,23,42,.18)"
        onClick={(event) => event.stopPropagation()}>
        <Flex
          position="sticky"
          top="0"
          zIndex="2"
          align="flex-start"
          gap="4"
          borderBottom="1px solid"
          borderColor="gray.200"
          bg="whiteAlpha.950"
          backdropFilter="blur(16px)"
          p={{ base: "5", md: "6" }}>
          <RiskBadge risk={incident.riskScore} />
          <Box flex="1">
            <Text color="gray.400" fontSize="xs" fontWeight="800">
              {incident.id} · {formatDate(incident.occurredAt)},{" "}
              {formatTime(incident.occurredAt)}
            </Text>
            <Heading mt="1" size="lg">
              {incident.title}
            </Heading>
          </Box>
          <Button
            variant="ghost"
            minW="10"
            px="0"
            borderRadius="full"
            aria-label="Закрыть"
            onClick={onClose}>
            <X size={20} />
          </Button>
        </Flex>

        <Box p={{ base: "5", md: "6" }}>
          {incident.clipUrl ?
            <EvidenceVideo
              path={incident.clipUrl}
              eventId={incident.visionEventId ? incident.id : undefined}
              seekSeconds={seekSeconds}
            />
          : <Box minH="150px" borderRadius="2xl" bg="gray.100" p="6">
              <StatusBadge status={incident.status} />
              <Text mt="4" fontWeight="800">
                Видеоклип пока недоступен
              </Text>
              <Text mt="2" color="gray.600">
                Запись ещё не доставлена или срок хранения истёк. Для решения
                используйте доступный контекст; при нехватке данных выберите «Не
                уверен».
              </Text>
            </Box>
          }
          <Heading mt="7" size="md">
            Что произошло
          </Heading>
          <Text mt="3" color="gray.600" lineHeight="1.7">
            {incident.description}
          </Text>
          <Grid
            mt="5"
            templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }}
            gap="3">
            <Fact
              icon={<Camera size={17} />}
              label="Камера"
              value={incident.cameraName}
            />
            <Fact
              icon={<ReceiptText size={17} />}
              label="POS-событие"
              value={incident.posEventId ?? "Не найдено"}
            />
          </Grid>

          <Box
            mt="7"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            overflow="hidden">
            <Flex
              justify="space-between"
              align="center"
              bg="gray.50"
              px="5"
              py="4">
              <Box>
                <Heading size="sm">Расчёт риска</Heading>
                <Text mt="1" color="gray.500" fontSize="xs">
                  Каждый сигнал можно проверить отдельно
                </Text>
              </Box>
              <Text color="red.600" fontSize="2xl" fontWeight="900">
                {incident.riskScore}
              </Text>
            </Flex>
            {incident.evidence.map((item) => (
              <Grid
                key={item.id}
                gridTemplateColumns="auto 1fr auto"
                gap="3"
                alignItems="start"
                borderTop="1px solid"
                borderColor="gray.100"
                px="5"
                py="4">
                <EvidenceIcon kind={item.kind} />
                <Box>
                  <Text fontSize="sm" fontWeight="800">
                    {item.label}
                  </Text>
                  <Text mt="1" color="gray.500" fontSize="xs">
                    {item.detail}
                  </Text>
                </Box>
                <Text
                  color={item.impact >= 30 ? "red.600" : "orange.600"}
                  fontWeight="900">
                  +{item.impact}
                </Text>
              </Grid>
            ))}
          </Box>

          <Box
            mt="7"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            p="5">
            <Heading size="sm">Хронология</Heading>
            {incident.timeline.map((item, index) => (
              <Box key={item.id}>
                <TimelineItem
                  item={item}
                  last={index === incident.timeline.length - 1}
                />
                {incident.clipUrl &&
                  incident.clipStartedAt &&
                  Date.parse(item.at) >= Date.parse(incident.clipStartedAt) &&
                  Date.parse(item.at) <=
                    Date.parse(incident.clipEndedAt ?? incident.occurredAt) && (
                    <Button
                      mt="2"
                      size="xs"
                      variant="ghost"
                      color="blue.600"
                      onClick={() =>
                        setSeekSeconds(
                          (Date.parse(item.at) -
                            Date.parse(incident.clipStartedAt!)) /
                            1000,
                        )
                      }>
                      Открыть момент в клипе
                    </Button>
                  )}
              </Box>
            ))}
          </Box>
          <Box
            mt="7"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            p="5">
            <Heading size="sm">POS-события рядом по времени</Heading>
            {incident.nearbyPosEvents === undefined ?
              <Text mt="3" color="gray.500">
                Загружаем контекст…
              </Text>
            : incident.nearbyPosEvents.length === 0 ?
              <Text mt="3" color="gray.500">
                В этом временном окне нет доступных POS-событий. Это само по
                себе не подтверждает нарушение.
              </Text>
            : incident.nearbyPosEvents.map((event) => (
                <Box
                  key={event.id}
                  mt="3"
                  borderTop="1px solid"
                  borderColor="gray.100"
                  pt="3">
                  <Text fontWeight="700">
                    {formatTime(event.occurredAt)} ·{" "}
                    {posEventTypeLabels[event.type] ?? event.title}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {event.registerName} · {event.transactionId}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {event.details}
                  </Text>
                </Box>
              ))
            }
          </Box>

          <Box
            mt="7"
            border="1px solid"
            borderColor="blue.100"
            borderRadius="xl"
            bg="blue.50/40"
            p="5">
            <Flex align="center" gap="2">
              <MessageSquareText size={18} />
              <Heading size="sm">Решение оператора</Heading>
            </Flex>
            <Text mt="4" mb="2" color="gray.600" fontSize="sm" fontWeight="700">
              Ответственный
            </Text>
            <Flex gap="2">
              <Input
                aria-label="Ответственный"
                disabled={!canReview}
                value={assignee}
                maxLength={120}
                placeholder="Имя или email оператора"
                onChange={(event) => setAssignee(event.target.value)}
              />
              <Button
                variant="outline"
                bg="white"
                disabled={!canReview}
                loading={busy}
                onClick={saveAssignment}>
                Назначить
              </Button>
            </Flex>
            <Text mt="4" mb="2" color="gray.600" fontSize="sm" fontWeight="700">
              Комментарий к решению
            </Text>
            <chakra.textarea
              aria-label="Комментарий к решению"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              w="full"
              minH="100px"
              resize="vertical"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              bg="white"
              px="3"
              py="2"
              placeholder="Что видно на клипе и почему принято решение?"
            />
            {(savedMessage || error) && (
              <Text
                mt="2"
                color={
                  error ? "red.600"
                  : savedMessage.startsWith("Добавьте") ?
                    "orange.600"
                  : "green.600"
                }
                fontSize="sm"
                fontWeight="700">
                {error || savedMessage}
              </Text>
            )}
          </Box>
        </Box>

        <Flex
          position="sticky"
          bottom="0"
          gap="3"
          wrap="wrap"
          borderTop="1px solid"
          borderColor="gray.200"
          bg="whiteAlpha.950"
          backdropFilter="blur(16px)"
          p={{ base: "4", md: "5" }}>
          <Button
            variant="ghost"
            aria-label="Следующий инцидент"
            onClick={onNext}>
            <ChevronLeft size={18} /> Следующий
          </Button>
          <Button
            flex="1"
            variant="outline"
            color="gray.700"
            disabled={!canReview}
            loading={busy}
            onClick={() => submitReview("false_positive")}>
            <XCircle size={18} /> Ложная тревога
          </Button>
          <Button
            flex="1"
            variant="outline"
            color="orange.700"
            disabled={!canReview}
            loading={busy}
            onClick={() => submitReview("unsure")}>
            Не уверен
          </Button>
          <Button
            flex="1"
            bg="green.600"
            color="white"
            disabled={!canReview}
            loading={busy}
            _hover={{ bg: "green.700" }}
            onClick={() => submitReview("confirmed")}>
            <Check size={18} /> Подтвердить
          </Button>
        </Flex>
      </Box>
    </Flex>
  );
}

function IncidentRow({
  incident,
  onOpen,
}: {
  incident: Incident;
  onOpen: () => void;
}) {
  return (
    <Box
      as="button"
      w="full"
      borderTop="1px solid"
      borderColor="gray.100"
      bg="white"
      px={{ base: "4", lg: "5" }}
      py="4"
      cursor="pointer"
      textAlign="left"
      _hover={{ bg: "blue.50/40" }}
      onClick={onOpen}>
      <Grid
        display={{ base: "grid", lg: "none" }}
        templateColumns="auto 1fr auto"
        gap="3">
        <RiskBadge risk={incident.riskScore} />
        <Box>
          <Text fontWeight="800">{incident.title}</Text>
          <Text mt="1" color="gray.500" fontSize="sm">
            {incident.id} · {incident.cameraName}
          </Text>
          <Flex mt="3" gap="2">
            <StatusBadge status={incident.status} />
            <Text color="gray.400" fontSize="xs">
              {formatDate(incident.occurredAt)},{" "}
              {formatTime(incident.occurredAt)}
            </Text>
          </Flex>
        </Box>
        <ChevronRight size={18} />
      </Grid>
      <Grid
        display={{ base: "none", lg: "grid" }}
        gridTemplateColumns="82px minmax(260px, 1.6fr) minmax(150px, .8fr) 120px 140px 48px"
        gap="3"
        alignItems="center">
        <RiskBadge risk={incident.riskScore} />
        <Box>
          <Text fontWeight="800">{incident.title}</Text>
          <Text mt="1" color="gray.400" fontSize="xs">
            {incident.id} · {incident.assignee ?? "Не назначен"}
          </Text>
        </Box>
        <Box>
          <Text fontWeight="700">{incident.cameraName}</Text>
          <Text mt="1" color="gray.400" fontSize="xs">
            {incident.device}
          </Text>
        </Box>
        <Box>
          <Text fontWeight="700">{formatTime(incident.occurredAt)}</Text>
          <Text mt="1" color="gray.400" fontSize="xs">
            {formatDate(incident.occurredAt)}
          </Text>
        </Box>
        <StatusBadge status={incident.status} />
        <ChevronRight size={17} />
      </Grid>
    </Box>
  );
}

function RiskBadge({ risk }: { risk: number }) {
  const critical = risk >= 80;
  const medium = risk >= 60;
  return (
    <Flex
      w="58px"
      align="center"
      justify="center"
      gap="1.5"
      borderRadius="lg"
      bg={
        critical ? "red.50"
        : medium ?
          "orange.50"
        : "gray.100"
      }
      color={
        critical ? "red.700"
        : medium ?
          "orange.700"
        : "gray.600"
      }
      px="2"
      py="2"
      fontSize="sm"
      fontWeight="900">
      <AlertTriangle size={14} />
      {risk}
    </Flex>
  );
}
function StatusBadge({ status }: { status: IncidentStatus }) {
  const colors: Record<IncidentStatus, [string, string]> = {
    review: ["orange.50", "orange.700"],
    awaiting_pos: ["purple.50", "purple.700"],
    confirmed: ["green.50", "green.700"],
    false_positive: ["gray.100", "gray.600"],
    unsure: ["orange.50", "orange.700"],
  };
  return (
    <Text
      display="inline-flex"
      w="fit-content"
      borderRadius="full"
      bg={colors[status][0]}
      color={colors[status][1]}
      px="3"
      py="1.5"
      fontSize="xs"
      fontWeight="800">
      {incidentStatusLabels[status]}
    </Text>
  );
}
function FilterSelect({
  children,
  label,
  value,
  onChange,
}: {
  children: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <chakra.select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      h="9"
      maxW="220px"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      bg="white"
      px="2">
      {children}
    </chakra.select>
  );
}
function SummaryCard({
  color,
  icon,
  label,
  value,
}: {
  color: "orange" | "red" | "green" | "blue";
  icon: ReactNode;
  label: string;
  value: string;
}) {
  const palette = {
    orange: ["orange.50", "orange.600"],
    red: ["red.50", "red.600"],
    green: ["green.50", "green.600"],
    blue: ["blue.50", "blue.600"],
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
function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Box borderRadius="xl" bg="gray.50" p="4">
      <Flex align="center" gap="2" color="gray.500" fontSize="xs">
        {icon}
        {label}
      </Flex>
      <Text mt="2" fontSize="sm" fontWeight="800">
        {value}
      </Text>
    </Box>
  );
}
function FilterGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <Flex align="center" gap="1" wrap="wrap">
      <Text mr="1" color="gray.500" fontSize="xs" fontWeight="800">
        {label}:
      </Text>
      {children}
    </Flex>
  );
}
function EvidenceIcon({
  kind,
}: {
  kind: Incident["evidence"][number]["kind"];
}) {
  return (
    <Flex
      boxSize="9"
      align="center"
      justify="center"
      borderRadius="lg"
      bg={
        kind === "vision" ? "purple.50"
        : kind === "pos" ?
          "blue.50"
        : "orange.50"
      }
      color={
        kind === "vision" ? "purple.600"
        : kind === "pos" ?
          "blue.600"
        : "orange.600"
      }>
      {kind === "vision" ?
        <Camera size={16} />
      : kind === "pos" ?
        <ReceiptText size={16} />
      : <ShieldAlert size={16} />}
    </Flex>
  );
}
function TimelineItem({
  item,
  last,
}: {
  item: Incident["timeline"][number];
  last: boolean;
}) {
  return (
    <Flex position="relative" gap="3" mt="4">
      <Box
        position="relative"
        zIndex="1"
        mt="1"
        boxSize="2.5"
        flex="0 0 auto"
        borderRadius="full"
        bg={item.actor === "operator" ? "green.500" : "blue.500"}
      />
      {!last && (
        <Box
          position="absolute"
          left="4px"
          top="12px"
          bottom="-20px"
          w="1px"
          bg="gray.200"
        />
      )}
      <Box flex="1">
        <Flex justify="space-between" gap="3">
          <Text fontSize="sm" fontWeight="800">
            {item.title}
          </Text>
          <Text color="gray.400" fontSize="xs">
            {formatTime(item.at)}
          </Text>
        </Flex>
        <Text mt="1" color="gray.500" fontSize="xs">
          {item.detail}
        </Text>
      </Box>
    </Flex>
  );
}
function LoadingState() {
  return (
    <Flex
      minH="240px"
      align="center"
      justify="center"
      direction="column"
      gap="3">
      <Spinner color="blue.500" />
      <Text color="gray.500">Загружаем инциденты…</Text>
    </Flex>
  );
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Flex
      minH="240px"
      align="center"
      justify="center"
      direction="column"
      gap="3">
      <ShieldAlert color="#dc2626" />
      <Text fontWeight="800">Не удалось загрузить инциденты</Text>
      <Button size="sm" onClick={onRetry}>
        Повторить
      </Button>
    </Flex>
  );
}
function EmptyState() {
  return (
    <Box py="16" textAlign="center">
      <Flex
        mx="auto"
        boxSize="12"
        align="center"
        justify="center"
        borderRadius="full"
        bg="gray.100"
        color="gray.500">
        <Search size={21} />
      </Flex>
      <Text mt="4" fontWeight="800">
        Инциденты не найдены
      </Text>
      <Text mt="1" color="gray.500" fontSize="sm">
        Измените запрос или фильтры.
      </Text>
    </Box>
  );
}
