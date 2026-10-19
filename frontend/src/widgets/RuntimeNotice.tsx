import { Box, Text } from "@chakra-ui/react";
import { useRuntimeConfig } from "../api/runtime";

export function RuntimeNotice() {
  const runtime = useRuntimeConfig();
  const demo = runtime.data?.demoMode === true;
  return (
    <Box
      role="status"
      mx={{ base: "5", md: "8" }}
      mb="5"
      p="3"
      borderRadius="lg"
      bg={
        runtime.isError ? "red.50"
        : demo ?
          "orange.50"
        : "blue.50"
      }>
      <Text
        fontSize="sm"
        color={
          runtime.isError ? "red.800"
          : demo ?
            "orange.800"
          : "blue.800"
        }>
        {runtime.isError ?
          "Режим сервера недоступен. Демонстрационные действия отключены."
        : runtime.isPending ?
          "Проверяем режим работы…"
        : demo ?
          "ДЕМО-РЕЖИМ · Камеры, POS-события, инциденты и отчёты содержат тестовые данные. Видео веб-камеры и распознавание — реальные."
        : "Рабочий режим · События поступают от подключённых камер и POS. Окончательное решение принимает оператор."
        }
      </Text>
    </Box>
  );
}
