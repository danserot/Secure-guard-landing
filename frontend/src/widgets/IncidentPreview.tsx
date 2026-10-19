import { Box, Flex, Grid, Heading, Text } from "@chakra-ui/react";
import type { IncidentScenario } from "../productContent";

export function IncidentPreview({
  scenarios,
}: {
  scenarios: IncidentScenario[];
}) {
  const scenario = scenarios[0];
  return (
    <Box
      as="aside"
      aria-label="Превью события безопасности"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="xl"
      p="5"
      bg="white"
      boxShadow="lg">
      <Flex
        align="center"
        justify="space-between"
        gap="3"
        mb="4"
        color="gray.500"
        fontSize="xs"
        textTransform="uppercase">
        <Text>Live event</Text>
        <Text
          as="strong"
          borderRadius="full"
          px="3"
          py="1.5"
          bg="blue.50"
          color="blue.600"
          fontWeight="800">
          Risk 86
        </Text>
      </Flex>
      <Box
        position="relative"
        aspectRatio="16/10"
        overflow="hidden"
        borderRadius="lg"
        bg="linear-gradient(145deg, #eef2f7, #dbe3ed 58%, #edf5ef)">
        <Zone inset="12% 52% 18% 8%" color="orange.400">
          Counter
        </Zone>
        <Zone inset="28% 34% 32% 48%" color="teal.400">
          Scanner
        </Zone>
        <Zone inset="52% 8% 12% 62%" color="red.400">
          Bag
        </Zone>
        <Box
          position="absolute"
          left="27%"
          top="45%"
          w="48%"
          h="3px"
          borderRadius="full"
          bg="linear-gradient(90deg, #f7be48, #50caa1, #ec5b5b)"
          transform="rotate(18deg)"
        />
      </Box>
      <Box px="1" pt="5" pb="2">
        <Heading as="h2" size="md" mb="2">
          {scenario.title}
        </Heading>
        <Text color="gray.500">{scenario.description}</Text>
      </Box>
      <Grid as="dl" templateColumns="repeat(3, 1fr)" gap="2" mt="3">
        {[
          ["Буфер", "-15/+15 сек"],
          ["POS окно", "+/-2 сек"],
          ["Статус", "На проверке"],
        ].map(([term, value]) => (
          <Box key={term} borderRadius="lg" p="3" bg="gray.50">
            <Text as="dt" color="gray.500" fontSize="xs">
              {term}
            </Text>
            <Text as="dd" mt="1" fontSize="sm" fontWeight="800">
              {value}
            </Text>
          </Box>
        ))}
      </Grid>
    </Box>
  );
}

function Zone({
  children,
  color,
  inset,
}: {
  children: string;
  color: string;
  inset: string;
}) {
  return (
    <Flex
      position="absolute"
      inset={inset}
      align="center"
      justify="center"
      border="2px solid"
      borderColor={color}
      bg="whiteAlpha.700"
      fontSize="xs"
      fontWeight="800">
      {children}
    </Flex>
  );
}
