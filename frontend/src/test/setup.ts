import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { resetDatabase } from "../data/localDatabase";
import { server } from "../mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => resetDatabase());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

