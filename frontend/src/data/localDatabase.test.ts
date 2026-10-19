import { beforeEach, describe, expect, it } from "vitest";
import {
  PRODUCT_DATABASE_KEY,
  readDatabase,
  resetDatabase,
  updateDatabase,
} from "./localDatabase";

describe("local product database", () => {
  beforeEach(() => resetDatabase());

  it("seeds and persists data", () => {
    const first = readDatabase();
    expect(first.incidents.length).toBeGreaterThan(0);
    expect(localStorage.getItem(PRODUCT_DATABASE_KEY)).not.toBeNull();
  });

  it("persists updates across reads", () => {
    updateDatabase((database) => ({
      ...database,
      settings: {
        ...database.settings,
        profile: { ...database.settings.profile, name: "Новый магазин" },
      },
    }));
    expect(readDatabase().settings.profile.name).toBe("Новый магазин");
  });
});
