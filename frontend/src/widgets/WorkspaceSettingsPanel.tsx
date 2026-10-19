import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Input,
  Text,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "../api/client";
import {
  useCameraConfigs,
  useCurrentUser,
  useSaveWorkspaceSettings,
  useWorkspaceSettings,
} from "../api/queries";
import { useRuntimeConfig } from "../api/runtime";
import type { WorkspaceSettings } from "../domain/models";

const schema = z.object({
  profile: z.object({
    name: z.string().trim().min(2),
    address: z.string().trim().min(2),
    timezone: z.string().trim().min(2),
    language: z.string().trim().min(2),
  }),
  notifications: z.object({
    criticalIncidents: z.boolean(),
    cameraOffline: z.boolean(),
    dailyReport: z.boolean(),
    serviceUpdates: z.boolean(),
  }),
  storage: z.object({
    ordinaryRetentionDays: z.number().int().min(1).max(365),
    confirmedRetentionDays: z.number().int().min(1).max(1095),
    automaticCleanup: z.boolean(),
  }),
  updatedAt: z.string(),
});
const sections = [
  "Профиль",
  "Камеры",
  "Интеграции",
  "Уведомления",
  "Доступ и журнал",
  "Хранение",
];

export function SettingsPanel() {
  const settings = useWorkspaceSettings();
  if (settings.isPending)
    return (
      <Text px="8" role="status">
        Загружаем настройки…
      </Text>
    );
  if (settings.isError)
    return (
      <Box px="8" role="alert">
        <Text>{settings.error.message}</Text>
        <Button onClick={() => void settings.refetch()}>Повторить</Button>
      </Box>
    );
  return <SettingsForm key={settings.data.updatedAt} initial={settings.data} />;
}

function SettingsForm({ initial }: { initial: WorkspaceSettings }) {
  const [section, setSection] = useState("Профиль");
  const runtime = useRuntimeConfig();
  const cameras = useCameraConfigs();
  const user = useCurrentUser();
  const canManage =
    user.data?.role === "admin" || user.data?.role === "manager";
  const save = useSaveWorkspaceSettings();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<WorkspaceSettings>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });
  const audit = useQuery({
    queryKey: ["audit"],
    enabled: section === "Доступ и журнал" && canManage,
    queryFn: () =>
      apiRequest<
        Array<{
          id: string;
          action: string;
          resource_id: string;
          actor_id: string;
          created_at: string;
        }>
      >("/api/v1/audit?limit=20"),
  });
  async function submit(values: WorkspaceSettings) {
    try {
      await save.mutateAsync({
        ...values,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      /* API error is rendered without discarding the form. */
    }
  }
  return (
    <Box px={{ base: "5", md: "8" }} pb="12">
      <Heading size="xl">Настройки пространства</Heading>
      <Text mt="2" mb="5" color="gray.500">
        {runtime.data?.dataSource === "browser" ?
          "Демо-настройки сохраняются в этом браузере."
        : "Настройки сохраняются на сервере рабочего пространства."}
      </Text>
      <Grid
        templateColumns={{ base: "1fr", lg: "220px minmax(0, 1fr)" }}
        gap="5"
        alignItems="start">
        <Flex
          as="nav"
          aria-label="Разделы настроек"
          bg="white"
          borderRadius="xl"
          p="2"
          direction={{ base: "row", lg: "column" }}
          gap="1"
          overflowX="auto">
          {sections.map((label) => (
            <Button
              key={label}
              variant="ghost"
              flexShrink="0"
              justifyContent="flex-start"
              bg={section === label ? "blue.50" : "transparent"}
              onClick={() => setSection(label)}>
              {label}
            </Button>
          ))}
        </Flex>
        <Box
          as="form"
          onSubmit={handleSubmit(submit)}
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="2xl"
          p={{ base: "5", md: "7" }}>
          <Heading size="lg" mb="5">
            {section}
          </Heading>
          {section === "Профиль" && (
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
              {(
                [
                  ["name", "Название магазина"],
                  ["address", "Адрес"],
                  ["timezone", "Часовой пояс"],
                  ["language", "Язык интерфейса"],
                ] as const
              ).map(([name, label]) => (
                <Box key={name}>
                  <Text mb="2">{label}</Text>
                  <Input
                    aria-label={label}
                    disabled={!canManage}
                    {...register(`profile.${name}`)}
                  />
                  {errors.profile?.[name] && (
                    <Text color="red.700" fontSize="sm">
                      Проверьте значение
                    </Text>
                  )}
                </Box>
              ))}
            </Grid>
          )}
          {section === "Камеры" && (
            <Grid gap="3">
              <Text color="gray.500">
                Подключение и разметка доступны в разделах «Камеры» и «Зоны».
              </Text>
              {cameras.isError ?
                <Text role="alert">Статусы камер недоступны</Text>
              : cameras.isPending ?
                <Text>Загружаем…</Text>
              : cameras.data.length === 0 ?
                <Text>Камеры ещё не настроены</Text>
              : cameras.data.map((camera) => (
                  <Flex
                    key={camera.camera_id}
                    justify="space-between"
                    p="3"
                    borderRadius="lg"
                    bg="gray.50">
                    <Text>
                      {camera.name} · {camera.zones.length} зон
                    </Text>
                    <Text>
                      {!camera.enabled ?
                        "Отключена"
                      : camera.health?.stream_alive ?
                        "Онлайн"
                      : "Нет связи"}
                    </Text>
                  </Flex>
                ))
              }
            </Grid>
          )}
          {section === "Интеграции" && (
            <Grid gap="4">
              <Text>
                POS:{" "}
                {runtime.data?.demoMode ?
                  "демонстрационный генератор"
                : "операции принимаются через POS-адаптер магазина"}
                .
              </Text>
              <Text>
                Клипы открываются через защищённый API. Доступность архива
                проверяется при просмотре.
              </Text>
              <Text>
                Уведомления требуют настроенного серверного канала. Сохранённые
                предпочтения не подтверждают доставку.
              </Text>
            </Grid>
          )}
          {section === "Уведомления" && (
            <Grid gap="4">
              {(
                [
                  ["criticalIncidents", "Критические инциденты"],
                  ["cameraOffline", "Камера не в сети"],
                  ["dailyReport", "Ежедневный отчёт"],
                  ["serviceUpdates", "Сервисные обновления"],
                ] as const
              ).map(([name, label]) => (
                <Controller
                  key={name}
                  name={`notifications.${name}`}
                  control={control}
                  render={({ field }) => (
                    <Flex as="label" gap="3" align="center">
                      <input
                        type="checkbox"
                        checked={field.value}
                        disabled={!canManage}
                        onChange={(event) =>
                          field.onChange(event.target.checked)
                        }
                      />
                      {label}
                    </Flex>
                  )}
                />
              ))}
              <Text color="gray.500" fontSize="sm">
                Предпочтения не подключают внешний канал доставки.
              </Text>
            </Grid>
          )}
          {section === "Доступ и журнал" && (
            <Box>
              <Text>
                {user.data?.email} · {user.data?.role}
              </Text>
              <Text mt="3" color="gray.500">
                Доступ к API защищён JWT. Для завершения сессии используйте
                кнопку «Выйти».
              </Text>
              {canManage && (
                <Box mt="5">
                  <Heading size="sm">Последние действия</Heading>
                  {audit.isPending ?
                    <Text>Загружаем журнал…</Text>
                  : audit.isError ?
                    <Text role="alert">
                      Журнал недоступен: {audit.error.message}
                    </Text>
                  : audit.data?.length === 0 ?
                    <Text mt="3">Действий пока нет</Text>
                  : audit.data?.map((entry) => (
                      <Box
                        key={entry.id}
                        mt="3"
                        pt="3"
                        borderTop="1px solid"
                        borderColor="gray.100">
                        <Text fontSize="sm" fontWeight="700">
                          {entry.action} · {entry.resource_id}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {new Date(entry.created_at).toLocaleString("ru-RU")} ·{" "}
                          {entry.actor_id}
                        </Text>
                      </Box>
                    ))
                  }
                </Box>
              )}
            </Box>
          )}
          {section === "Хранение" && (
            <Grid gap="4">
              {(
                [
                  ["ordinaryRetentionDays", "Обычные события, дней", 365],
                  [
                    "confirmedRetentionDays",
                    "Подтверждённые события, дней",
                    1095,
                  ],
                ] as const
              ).map(([name, label, max]) => (
                <Box key={name}>
                  <Text mb="2">{label}</Text>
                  <Input
                    aria-label={label}
                    type="number"
                    min={1}
                    max={max}
                    disabled={!canManage}
                    {...register(`storage.${name}`, { valueAsNumber: true })}
                  />
                  {errors.storage?.[name] && (
                    <Text color="red.700">Допустимо от 1 до {max} дней</Text>
                  )}
                </Box>
              ))}
              <Controller
                name="storage.automaticCleanup"
                control={control}
                render={({ field }) => (
                  <Flex as="label" gap="3">
                    <input
                      type="checkbox"
                      checked={field.value}
                      disabled={!canManage}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                    Автоматическая очистка
                  </Flex>
                )}
              />
              <Text color="gray.500" fontSize="sm">
                После истечения срока хранения клип может стать недоступен.
                Ссылки на просмотр имеют отдельный ограниченный срок действия.
              </Text>
            </Grid>
          )}
          {["Профиль", "Уведомления", "Хранение"].includes(section) && (
            <Flex justify="space-between" align="center" gap="3" mt="6">
              <Text
                role={save.isError ? "alert" : "status"}
                color={save.isError ? "red.700" : "gray.500"}
                fontSize="sm">
                {save.error?.message ??
                  (isDirty ?
                    "Есть несохранённые изменения"
                  : "Настройки сохранены")}
              </Text>
              <Button
                type="submit"
                colorPalette="blue"
                loading={save.isPending}
                disabled={!canManage || !isDirty}>
                Сохранить
              </Button>
            </Flex>
          )}
        </Box>
      </Grid>
    </Box>
  );
}
