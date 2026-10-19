import { Box, Button, Flex, Grid, Heading, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useCameraConfigs, useEventAnalytics } from "../api/queries";

export function AnalyticsPanel() {
  const [days, setDays] = useState(30);
  const [camera, setCamera] = useState("");
  const query = useEventAnalytics(days, camera);
  const cameras = useCameraConfigs();
  const summary = query.data;
  const metrics: [string, string][] = [
    ["Событий", String(summary?.total ?? "—")],
    ["Высокий риск", String(summary?.highRisk ?? "—")],
    ["Подтверждено оператором", String(summary?.confirmed ?? "—")],
    ["Ложных срабатываний", String(summary?.falsePositive ?? "—")],
    ["Ожидают проверки", String(summary?.pending ?? "—")],
    ["С сохранённым клипом", String(summary?.withClips ?? "—")],
    [
      "Среднее время до решения",
      summary?.meanReviewSeconds == null ?
        "Нет решений"
      : `${Math.round(summary.meanReviewSeconds)} с`,
    ],
  ];
  function exportReport() {
    const csv = [
      ["Период (дни)", String(days)],
      ["Камера", camera || "Все"],
      ...metrics,
    ]
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "secureguard-events.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Box px={{ base: "5", md: "8" }} pb="12">
      <Heading size="xl">Статистика событий</Heading>
      <Text my="3">
        По сохранённым событиям текущего режима. Подтверждение оператором не
        означает доказанную кражу. Точность модели и доступность камер здесь не
        измеряются.
      </Text>
      <Flex gap="2" wrap="wrap" mb="4">
        {[7, 30, 90].map((value) => (
          <Button
            key={value}
            variant={days === value ? "solid" : "outline"}
            onClick={() => setDays(value)}>
            {value} дней
          </Button>
        ))}
        <Button
          variant="outline"
          disabled={!query.isSuccess || query.isFetching}
          onClick={exportReport}>
          Скачать отчёт
        </Button>
      </Flex>
      <Flex gap="2" wrap="wrap" mb="4">
        <Button size="sm" onClick={() => setCamera("")}>
          Все камеры
        </Button>
        {cameras.data?.map((item) => (
          <Button
            size="sm"
            variant={camera === item.camera_id ? "solid" : "outline"}
            key={item.camera_id}
            onClick={() => setCamera(item.camera_id)}>
            {item.name}
          </Button>
        ))}
      </Flex>
      {query.isPending ?
        <Text>Загрузка…</Text>
      : query.isError ?
        <Text role="alert">
          Статистика недоступна.{" "}
          <Button onClick={() => void query.refetch()}>Повторить</Button>
        </Text>
      : <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="4">
          {metrics.map(([label, value]) => (
            <Box
              key={label}
              p="5"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="xl">
              <Text fontSize="2xl" fontWeight="bold">
                {value}
              </Text>
              <Text>{label}</Text>
            </Box>
          ))}
        </Grid>
      }
    </Box>
  );
}
