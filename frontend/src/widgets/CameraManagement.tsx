import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Input,
  Text,
  chakra,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  useCameraConfigs,
  useCurrentUser,
  useSaveCameraConfig,
  useStores,
  useTerminals,
} from "../api/queries";
import { workspaceRepository } from "../api/repositories";
import type { CameraConfig, Store, Terminal } from "../domain/models";

const emptyCamera: CameraConfig = {
  camera_id: "",
  name: "",
  store_id: "",
  terminal_id: "",
  source: "env:RTSP_CAMERA_1",
  enabled: true,
  target_fps: 5,
  product_labels: ["product"],
  zones: [],
};

export function CameraManagement() {
  const cameras = useCameraConfigs();
  const stores = useStores();
  const terminals = useTerminals();
  const user = useCurrentUser();
  const admin = user.data?.role === "admin" || user.data?.role === "manager";
  const [editing, setEditing] = useState<CameraConfig | null>(null);
  const [showLocations, setShowLocations] = useState(false);

  return (
    <Box mt="5" mb="7">
      <Flex justify="space-between" gap="3" wrap="wrap" mb="4">
        <Box>
          <Heading size="md">Подключённые камеры</Heading>
          <Text color="gray.500" mt="1" fontSize="sm">
            Статус обновляется каждые 10 секунд. Зоны настраиваются в разделе
            «Зоны».
          </Text>
        </Box>
        {admin && (
          <Flex gap="2">
            <Button
              variant="outline"
              onClick={() => setShowLocations((value) => !value)}>
              Магазины и кассы
            </Button>
            <Button
              colorPalette="blue"
              onClick={() =>
                setEditing({
                  ...emptyCamera,
                  store_id: stores.data?.[0]?.id ?? "",
                })
              }>
              Подключить IP-камеру
            </Button>
          </Flex>
        )}
      </Flex>
      {showLocations && admin && <LocationSetup stores={stores.data ?? []} />}
      {cameras.isPending && <Text role="status">Загружаем камеры…</Text>}
      {cameras.isError && (
        <Box role="alert">
          <Text color="red.700">
            Не удалось загрузить камеры: {cameras.error.message}
          </Text>
          <Button size="sm" mt="2" onClick={() => void cameras.refetch()}>
            Повторить
          </Button>
        </Box>
      )}
      {cameras.isSuccess && cameras.data.length === 0 && (
        <Box p="5" bg="white" borderRadius="xl">
          <Text>IP-камеры ещё не подключены.</Text>
          <Text mt="1" color="gray.500" fontSize="sm">
            {admin ?
              "Добавьте магазин, кассу и камеру. Источник видео задаётся на edge-агенте."
            : "Администратор может подключить камеры этого рабочего пространства."
            }
          </Text>
        </Box>
      )}
      <Grid templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }} gap="4">
        {cameras.data?.map((camera) => {
          const lastSeen =
            camera.health?.last_seen ? Date.parse(camera.health.last_seen) : 0;
          const online =
            camera.enabled &&
            camera.health?.stream_alive &&
            cameras.dataUpdatedAt - lastSeen < 90_000;
          return (
            <Box
              key={camera.camera_id}
              border="1px solid"
              borderColor="gray.200"
              borderRadius="xl"
              bg="white"
              p="5">
              <Flex justify="space-between" gap="3">
                <Box>
                  <Heading size="sm">{camera.name}</Heading>
                  <Text mt="1" fontSize="sm" color="gray.500">
                    {stores.data?.find((store) => store.id === camera.store_id)
                      ?.name ?? camera.store_id}{" "}
                    ·{" "}
                    {terminals.data?.find(
                      (terminal) => terminal.id === camera.terminal_id,
                    )?.name ?? camera.terminal_id}
                  </Text>
                </Box>
                <Text
                  h="fit-content"
                  bg={online ? "green.50" : "gray.100"}
                  color={online ? "green.700" : "gray.600"}
                  borderRadius="full"
                  px="3"
                  py="1"
                  fontSize="xs"
                  fontWeight="700">
                  {!camera.enabled ?
                    "Отключена"
                  : online ?
                    "Онлайн"
                  : "Нет связи"}
                </Text>
              </Flex>
              <Text mt="4" fontSize="sm">
                Зон контроля: {camera.zones.length}
                {camera.zones.length === 0 ? " · требуется разметка" : ""}
              </Text>
              <Text mt="1" color="gray.500" fontSize="xs">
                {lastSeen ?
                  `Последний сигнал: ${new Date(lastSeen).toLocaleString("ru-RU")}`
                : "Ожидаем первый сигнал камеры"}
              </Text>
              {camera.enabled && !online && (
                <Text mt="2" color="orange.700" fontSize="sm">
                  Проверьте питание камеры и подключение агента магазина.
                </Text>
              )}
              {admin && (
                <Button
                  size="sm"
                  variant="outline"
                  mt="4"
                  onClick={() => setEditing(camera)}>
                  Настроить
                </Button>
              )}
            </Box>
          );
        })}
      </Grid>
      {editing && (
        <CameraConfigForm
          key={editing.camera_id || "new"}
          initial={editing}
          stores={stores.data ?? []}
          terminals={terminals.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </Box>
  );
}

function CameraConfigForm({
  initial,
  stores,
  terminals,
  onClose,
}: {
  initial: CameraConfig;
  stores: Store[];
  terminals: Terminal[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [labels, setLabels] = useState(initial.product_labels.join(", "));
  const save = useSaveCameraConfig();
  const [validation, setValidation] = useState("");
  const update = <K extends keyof CameraConfig>(
    key: K,
    value: CameraConfig[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^(env:[A-Z][A-Z0-9_]*|\d+)$/.test(draft.source)) {
      setValidation(
        "Укажите имя переменной, например env:RTSP_CAMERA_1, или номер локальной камеры. Пароль камеры хранится на агенте.",
      );
      return;
    }
    try {
      await save.mutateAsync({
        ...draft,
        product_labels: labels
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean),
      });
      onClose();
    } catch {
      /* Keep the form available for retry. */
    }
  }
  return (
    <Flex
      position="fixed"
      inset="0"
      zIndex="30"
      bg="blackAlpha.500"
      justify="center"
      align="center"
      p="4"
      onClick={onClose}>
      <Box
        as="form"
        role="dialog"
        aria-modal="true"
        aria-label="Настройка IP-камеры"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        w="min(100%, 650px)"
        maxH="90svh"
        overflowY="auto"
        bg="white"
        borderRadius="2xl"
        p="6">
        <Heading size="lg">
          {initial.camera_id ? "Настройка камеры" : "Подключение IP-камеры"}
        </Heading>
        <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="4" mt="5">
          <Field label="ID камеры">
            <Input
              aria-label="ID камеры"
              required
              pattern="[A-Za-z0-9_.:-]+"
              maxLength={64}
              disabled={!!initial.camera_id}
              value={draft.camera_id}
              onChange={(event) => update("camera_id", event.target.value)}
              placeholder="camera-01"
            />
          </Field>
          <Field label="Название камеры">
            <Input
              aria-label="Название камеры"
              required
              maxLength={120}
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Касса у входа"
            />
          </Field>
          <Field label="Магазин камеры">
            <Select
              label="Магазин камеры"
              disabled={!!initial.camera_id}
              value={draft.store_id}
              onChange={(value) => {
                update("store_id", value);
                update("terminal_id", "");
              }}>
              <option value="">Выберите магазин</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Касса камеры">
            <Select
              label="Касса камеры"
              disabled={!!initial.camera_id}
              value={draft.terminal_id}
              onChange={(value) => update("terminal_id", value)}>
              <option value="">Выберите кассу</option>
              {terminals
                .filter((terminal) => terminal.store_id === draft.store_id)
                .map((terminal) => (
                  <option key={terminal.id} value={terminal.id}>
                    {terminal.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Источник на агенте">
            <Input
              aria-label="Источник на агенте"
              required
              value={draft.source}
              onChange={(event) => update("source", event.target.value)}
              placeholder="env:RTSP_CAMERA_1"
            />
          </Field>
          <Field label="Кадров для анализа в секунду">
            <Input
              aria-label="Кадров для анализа в секунду"
              type="number"
              min={1}
              max={30}
              step={0.1}
              required
              value={draft.target_fps}
              onChange={(event) =>
                update("target_fps", Number(event.target.value))
              }
            />
          </Field>
        </Grid>
        <Text mt="2" color="gray.500" fontSize="xs">
          RTSP-адрес и пароль задаются в переменной окружения edge-агента. Они
          не отправляются в браузер.
        </Text>
        <Box mt="4">
          <Field label="Классы товаров YOLO">
            <Input
              aria-label="Классы товаров YOLO"
              required
              value={labels}
              onChange={(event) => setLabels(event.target.value)}
              placeholder="product, bottle, cup"
            />
          </Field>
          <Text mt="2" color="gray.500" fontSize="xs">
            Через запятую, точные имена классов установленной модели. Для
            собственного класса product нужны обученные веса.
          </Text>
        </Box>
        <Flex as="label" align="center" gap="2" mt="4">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
          />
          Камера включена
        </Flex>
        {(validation || save.isError) && (
          <Text mt="3" role="alert" color="red.700">
            {save.error?.message ?? validation}
          </Text>
        )}
        <Flex justify="flex-end" mt="5" gap="3">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" colorPalette="blue" loading={save.isPending}>
            Сохранить камеру
          </Button>
        </Flex>
      </Box>
    </Flex>
  );
}

function LocationSetup({ stores }: { stores: Store[] }) {
  const client = useQueryClient();
  const [kind, setKind] = useState<"store" | "terminal">("store");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const create = useMutation({
    mutationFn: async () => {
      if (kind === "store")
        await workspaceRepository.createStore({ id, name, timezone });
      else
        await workspaceRepository.createTerminal({
          id,
          name,
          store_id: storeId,
        });
    },
    onSuccess: async () => {
      setId("");
      setName("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["stores"] }),
        client.invalidateQueries({ queryKey: ["terminals"] }),
      ]);
    },
  });
  return (
    <Box
      as="form"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="xl"
      p="5"
      mb="5">
      <Heading size="sm">Добавить магазин или кассу</Heading>
      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
        gap="3"
        mt="4">
        <Field label="Тип записи">
          <Select
            label="Тип записи"
            value={kind}
            onChange={(value) => setKind(value as "store" | "terminal")}>
            <option value="store">Магазин</option>
            <option value="terminal">Касса</option>
          </Select>
        </Field>
        <Field label="Идентификатор">
          <Input
            aria-label="Идентификатор"
            required
            pattern="[A-Za-z0-9_.:-]+"
            maxLength={64}
            value={id}
            onChange={(event) => setId(event.target.value)}
          />
        </Field>
        <Field label="Название">
          <Input
            aria-label="Название"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {kind === "store" ?
          <Field label="Часовой пояс">
            <Input
              aria-label="Часовой пояс"
              required
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="Asia/Almaty"
            />
          </Field>
        : <Field label="Магазин кассы">
            <Select label="Магазин кассы" value={storeId} onChange={setStoreId}>
              <option value="">Выберите магазин</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </Field>
        }
      </Grid>
      <Button
        type="submit"
        mt="4"
        colorPalette="blue"
        loading={create.isPending}>
        Добавить {kind === "store" ? "магазин" : "кассу"}
      </Button>
      {create.isError && (
        <Text mt="2" role="alert" color="red.700">
          {create.error.message}
        </Text>
      )}
      {create.isSuccess && (
        <Text mt="2" role="status" color="green.700">
          Запись сохранена
        </Text>
      )}
    </Box>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Text mb="2" fontSize="sm" fontWeight="700">
        {label}
      </Text>
      {children}
    </Box>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <chakra.select
      aria-label={label}
      value={value}
      required
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      w="full"
      h="10"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="md"
      px="3"
      bg="white">
      {children}
    </chakra.select>
  );
}
