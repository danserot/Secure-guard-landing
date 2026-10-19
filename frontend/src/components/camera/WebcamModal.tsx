import { Box, Flex, Heading, IconButton, Text } from "@chakra-ui/react";
import { Camera, ShieldCheck, X } from "lucide-react";
import { useEffect } from "react";
import { WebcamViewer } from "./WebcamViewer";

export function WebcamModal({
  onAdded,
  onClose,
}: {
  onAdded: () => void;
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
      zIndex="40"
      align={{ base: "flex-end", sm: "center" }}
      justify="center"
      bg="blackAlpha.600"
      p={{ base: "0", sm: "5" }}
      onClick={onClose}>
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby="webcam-title"
        w="min(100%, 1120px)"
        maxH={{ base: "100svh", sm: "94svh" }}
        overflow="auto"
        border="1px solid"
        borderColor="whiteAlpha.700"
        borderRadius={{ base: "3xl 3xl 0 0", sm: "3xl" }}
        bg="white"
        boxShadow="2xl"
        onClick={(event) => event.stopPropagation()}>
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
            <Camera size={22} />
          </Flex>
          <Box flex="1">
            <Heading id="webcam-title" size="lg">
              Веб-камера
            </Heading>
            <Text mt="1" color="gray.500" fontSize="sm">
              Разрешите доступ к камере для локального анализа видеопотока.
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

        <WebcamViewer onCameraStarted={onAdded} />

        <Flex
          align="center"
          gap="2"
          borderTop="1px solid"
          borderColor="gray.100"
          bg="gray.50"
          color="gray.600"
          px={{ base: "5", sm: "6" }}
          py="3">
          <ShieldCheck size={16} />
          <Text fontSize="xs" fontWeight="700">
            MediaPipe работает в браузере; отдельные кадры отправляются в
            локальный Vision API и не сохраняются.
          </Text>
        </Flex>
      </Box>
    </Flex>
  );
}
