import {
  Box,
  Button,
  ChakraProvider,
  Heading,
  Text,
  defaultSystem,
} from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Component, type ErrorInfo, type ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SecureGuard UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box
        maxW="680px"
        mx="auto"
        mt="20"
        border="1px solid"
        borderColor="red.200"
        borderRadius="2xl"
        bg="white"
        p="8"
        boxShadow="lg">
        <Text color="red.600" fontSize="sm" fontWeight="800">
          ИНТЕРФЕЙС ВРЕМЕННО НЕДОСТУПЕН
        </Text>
        <Heading mt="2" size="lg">
          Не удалось отобразить страницу
        </Heading>
        <Text mt="3" color="gray.600">
          Данные сохранены. Перезагрузите приложение и повторите действие.
        </Text>
        <Button
          mt="6"
          bg="blue.600"
          color="white"
          onClick={() => window.location.reload()}>
          Перезагрузить
        </Button>
      </Box>
    );
  }
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={defaultSystem}>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </AppErrorBoundary>
    </ChakraProvider>
  );
}
