import { Box, Flex, Grid, Heading, Text } from "@chakra-ui/react";
import type { ArchitectureLayer } from "../productContent";

export function ArchitectureMap({ layers }: { layers: ArchitectureLayer[] }) {
  return (
    <Grid
      templateColumns={{
        base: "1fr",
        md: "repeat(2, 1fr)",
        xl: "repeat(4, 1fr)",
      }}
      border="1px solid"
      borderColor="gray.200"
      bg="white">
      {layers.map((layer, index) => (
        <Box
          as="article"
          key={layer.title}
          minH="330px"
          p="6"
          borderRight={{ xl: index < layers.length - 1 ? "1px solid" : "0" }}
          borderBottom={{
            base: index < layers.length - 1 ? "1px solid" : "0",
            xl: "0",
          }}
          borderColor="gray.200">
          <Text color="orange.700" fontSize="xs" fontWeight="900">
            {String(index + 1).padStart(2, "0")}
          </Text>
          <Heading as="h3" mt="5" mb="3" size="md">
            {layer.title}
          </Heading>
          <Text minH={{ xl: "92px" }} color="gray.500">
            {layer.description}
          </Text>
          <Flex as="ul" wrap="wrap" gap="2" mt="6" listStyleType="none">
            {layer.stack.map((item) => (
              <Box
                as="li"
                key={item}
                borderRadius="full"
                px="3"
                py="1.5"
                bg="gray.100"
                fontSize="xs"
                fontWeight="700">
                {item}
              </Box>
            ))}
          </Flex>
        </Box>
      ))}
    </Grid>
  );
}
