import { Box, Button, Flex, Heading, Spinner, Text } from "@chakra-ui/react";
import { Camera, CameraOff, RefreshCw, ShieldCheck } from "lucide-react";

export type CameraPermissionState =
  | "idle"
  | "requesting"
  | "allowed"
  | "denied"
  | "camera-not-found"
  | "camera-busy"
  | "unsupported-browser"
  | "error";

const messages: Record<
  Exclude<CameraPermissionState, "allowed" | "requesting">,
  { title: string; text: string }
> = {
  idle: {
    title: "Веб-камера",
    text: "Разрешите доступ к камере для локального анализа видеопотока.",
  },
  denied: {
    title: "Доступ к камере запрещён",
    text: "Разрешите использование камеры в настройках браузера и повторите попытку.",
  },
  "camera-not-found": {
    title: "Камера не найдена",
    text: "Подключите веб-камеру и убедитесь, что она доступна системе.",
  },
  "camera-busy": {
    title: "Камера занята",
    text: "Закройте приложение, которое использует камеру, и повторите попытку.",
  },
  "unsupported-browser": {
    title: "Камера недоступна",
    text: "Откройте сайт через HTTPS или localhost в современном браузере с поддержкой webcam.",
  },
  error: {
    title: "Не удалось запустить камеру",
    text: "Проверьте подключение камеры и повторите попытку.",
  },
};

export function CameraPermission({
  state,
  onRequest,
}: {
  state: CameraPermissionState;
  onRequest: () => void;
}) {
  if (state === "allowed") return null;

  if (state === "requesting") {
    return (
      <Flex
        minH="360px"
        direction="column"
        align="center"
        justify="center"
        gap="4"
        p="8"
        textAlign="center">
        <Spinner size="lg" color="blue.600" />
        <Box>
          <Heading size="md">Ожидаем разрешение браузера</Heading>
          <Text mt="2" color="gray.500">
            Выберите камеру и подтвердите доступ. Микрофон не запрашивается.
          </Text>
        </Box>
      </Flex>
    );
  }

  const message = messages[state];
  const retry = state !== "idle";
  const Icon = retry ? CameraOff : Camera;

  return (
    <Flex
      minH="360px"
      direction="column"
      align="center"
      justify="center"
      gap="5"
      p={{ base: "6", sm: "10" }}
      textAlign="center">
      <Flex
        boxSize="14"
        align="center"
        justify="center"
        borderRadius="2xl"
        bg={retry ? "red.50" : "blue.50"}
        color={retry ? "red.600" : "blue.600"}>
        <Icon size={26} />
      </Flex>
      <Box maxW="520px">
        <Heading size="lg">{message.title}</Heading>
        <Text mt="2" color="gray.500">
          {message.text}
        </Text>
      </Box>
      <Button
        bg="blue.600"
        color="white"
        _hover={{ bg: "blue.700" }}
        onClick={onRequest}>
        {retry ?
          <RefreshCw size={18} />
        : <ShieldCheck size={18} />}
        {retry ? "Повторить" : "Разрешить доступ к камере"}
      </Button>
      <Text maxW="560px" color="gray.500" fontSize="sm">
        MediaPipe работает в браузере. Отдельные кадры отправляются в локальный
        Vision API для поиска объектов и не сохраняются.
      </Text>
    </Flex>
  );
}
