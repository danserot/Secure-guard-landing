import { Box, Grid, Heading, Text } from "@chakra-ui/react";
import type { RoadmapStage } from "../productContent";

export function RoadmapTimeline({ stages }: { stages: RoadmapStage[] }) {
  return (
    <Grid gap="3">
      {stages.map((stage) => (
        <Grid
          as="article"
          key={stage.title}
          templateColumns={{ base: "1fr", sm: "120px minmax(0, 1fr)" }}
          gap={{ base: "2", sm: "6" }}
          alignItems="start"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="xl"
          p="5"
          bg="white">
          <Text as="time" color="orange.700" fontSize="sm" fontWeight="900">
            {stage.period}
          </Text>
          <Box>
            <Heading as="h3" size="md" mb="2">
              {stage.title}
            </Heading>
            <Text color="gray.500">{stage.outcome}</Text>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}
