import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SETTINGS,
  SettingsStore,
  type SettingsPort,
} from "../../src/storage/settings_store";

// In-memory fake of the settings port — the seam every store test injects.
class FakePort implements SettingsPort {
  constructor(public data: unknown = undefined) {}
  read(): unknown {
    return this.data;
  }
  write(data: unknown): void {
    this.data = data;
  }
}

describe("SettingsStore", () => {
  test("empty storage loads the defaults", () => {
    expect(new SettingsStore(new FakePort()).load()).toEqual(DEFAULT_SETTINGS);
  });

  test("loads a persisted theme", () => {
    expect(new SettingsStore(new FakePort({ theme: "rush" })).load()).toEqual({
      theme: "rush",
    });
  });

  test("falls back to default theme on an unknown value", () => {
    expect(new SettingsStore(new FakePort({ theme: "neon" })).load().theme).toBe("slate");
  });

  test("ignores a non-object payload", () => {
    expect(new SettingsStore(new FakePort([1, 2, 3])).load()).toEqual(DEFAULT_SETTINGS);
  });

  test("save round-trips through the port", () => {
    const port = new FakePort();
    const store = new SettingsStore(port);
    store.save({ theme: "rush" });
    expect(store.load().theme).toBe("rush");
  });

  test("save preserves unknown keys already on disk", () => {
    const port = new FakePort({ theme: "slate", locale: "pt-BR" });
    new SettingsStore(port).save({ theme: "rush" });
    expect(port.data).toEqual({ theme: "rush", locale: "pt-BR" });
  });

  test("a failing write never throws", () => {
    const port: SettingsPort = {
      read: () => ({}),
      write: () => {
        throw new Error("disk full");
      },
    };
    expect(() => new SettingsStore(port).save({ theme: "rush" })).not.toThrow();
  });
});
