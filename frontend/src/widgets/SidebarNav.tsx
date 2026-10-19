import { Box, Button, Flex, Grid, Text } from "@chakra-ui/react";
import { ShieldCheck } from "lucide-react";
import type { NavigationItem, PageId } from "../productContent";

type SidebarNavProps = {
  activePage: PageId;
  items: NavigationItem[];
  onPageChange: (pageId: PageId) => void;
};

function BrandLogo() {
  return (
    <Flex align="center" gap="3">
      <Flex
        aria-hidden="true"
        align="center"
        justify="center"
        boxSize="40px"
        border="1px solid"
        borderColor="gray.300"
        borderRadius="xl"
        bg="white"
        color="blue.600"
        boxShadow="sm">
        <ShieldCheck size={20} strokeWidth={2.2} />
      </Flex>
      <Box textAlign="left">
        <Text fontWeight="800" lineHeight="1.1">
          SecureGuard
        </Text>
        <Text mt="1" color="gray.500" fontSize="xs" fontWeight="600">
          AI Control
        </Text>
      </Box>
    </Flex>
  );
}

const mobileTabs: PageId[] = [
  "overview",
  "cameras",
  "zones",
  "incidents",
  "settings",
];

export function SidebarNav({
  activePage,
  items,
  onPageChange,
}: SidebarNavProps) {
  return (
    <>
      <Flex
        as="aside"
        aria-label="Основная навигация"
        position="sticky"
        top="0"
        display={{ base: "none", lg: "flex" }}
        w="264px"
        h="100svh"
        flex="0 0 264px"
        direction="column"
        borderRight="1px solid"
        borderColor="whiteAlpha.700"
        bg="whiteAlpha.800"
        backdropFilter="blur(24px)"
        p="3">
        <Button
          variant="ghost"
          justifyContent="flex-start"
          h="auto"
          p="2"
          onClick={() => onPageChange("overview")}>
          <BrandLogo />
        </Button>
        <NavList
          activePage={activePage}
          items={items}
          onPageChange={onPageChange}
        />
      </Flex>

      <Box
        as="nav"
        aria-label="Мобильная навигация"
        position="fixed"
        insetInline="0"
        bottom="0"
        zIndex="10"
        display={{ base: "block", lg: "none" }}
        borderTop="1px solid"
        borderColor="whiteAlpha.700"
        bg="whiteAlpha.900"
        backdropFilter="blur(26px)"
        px="2"
        pt="1.5"
        pb="max(6px, env(safe-area-inset-bottom))"
        boxShadow="0 -12px 34px rgba(15, 23, 42, .08)">
        <NavList
          activePage={activePage}
          items={items.filter((item) => mobileTabs.includes(item.id))}
          onPageChange={onPageChange}
          mobile
        />
      </Box>
    </>
  );
}

function NavList({
  activePage,
  items,
  mobile = false,
  onPageChange,
}: SidebarNavProps & { mobile?: boolean }) {
  return (
    <Grid
      templateColumns={
        mobile ? `repeat(${items.length}, minmax(0, 1fr))` : "1fr"
      }
      gap="1"
      mt={mobile ? "0" : "6"}
      maxW={mobile ? "560px" : undefined}
      mx={mobile ? "auto" : undefined}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = activePage === item.id;
        return (
          <Button
            key={item.id}
            variant="ghost"
            aria-current={active ? "page" : undefined}
            minH={mobile ? "58px" : "42px"}
            h="auto"
            justifyContent={mobile ? "center" : "flex-start"}
            flexDirection={mobile ? "column" : "row"}
            gap={mobile ? "1" : "3"}
            px={mobile ? "1" : "3"}
            color={active ? "blue.600" : "gray.500"}
            bg={active ? "blue.50" : "transparent"}
            fontSize={mobile ? "xs" : "sm"}
            fontWeight="700"
            _hover={{ bg: active ? "blue.50" : "whiteAlpha.700" }}
            onClick={() => onPageChange(item.id)}>
            <Flex boxSize="7" align="center" justify="center">
              <Icon size={18} />
            </Flex>
            {item.label}
          </Button>
        );
      })}
    </Grid>
  );
}
