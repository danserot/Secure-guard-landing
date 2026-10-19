import { Box, Grid, Text } from "@chakra-ui/react";
import type { ProductMetric } from "../productContent";

export function MetricStrip({ metrics }: { metrics: ProductMetric[] }) {
  return (
    <Grid
      as="section"
      aria-label="Целевые метрики MVP"
      templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
      borderY="1px solid"
      borderColor="gray.200"
      bg="white">
      {metrics.map((metric, index) => (
        <Box
          key={metric.label}
          minH="128px"
          px={{ base: "5", xl: "8" }}
          py="6"
          borderRight={index < metrics.length - 1 ? "1px solid" : undefined}
          borderColor="gray.200">
          <Text fontSize="2xl" fontWeight="800" lineHeight="1">
            {metric.value}
          </Text>
          <Text mt="3" maxW="220px" color="gray.500">
            {metric.label}
          </Text>
        </Box>
      ))}
    </Grid>
  );
}
