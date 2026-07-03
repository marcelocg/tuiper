import { describe, expect, test } from "bun:test";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALES,
  localeFromEnv,
  nextLocale,
} from "../../src/engine/locale";

describe("locale identity", () => {
  test("LOCALES lists en and pt-BR in cycle order", () => {
    expect(LOCALES).toEqual(["en", "pt-BR"]);
  });

  test("default locale is en", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  test("nextLocale cycles en → pt-BR → en", () => {
    expect(nextLocale("en")).toBe("pt-BR");
    expect(nextLocale("pt-BR")).toBe("en");
  });

  test("isLocale accepts known names, rejects everything else", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pt-BR")).toBe(true);
    expect(isLocale("pt-br")).toBe(false); // exact tag only
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(42)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("localeFromEnv", () => {
  test("maps Portuguese $LANG variants to pt-BR", () => {
    expect(localeFromEnv("pt_BR.UTF-8")).toBe("pt-BR");
    expect(localeFromEnv("pt_PT")).toBe("pt-BR");
    expect(localeFromEnv("pt")).toBe("pt-BR");
  });

  test("maps English $LANG variants to en", () => {
    expect(localeFromEnv("en_US.UTF-8")).toBe("en");
    expect(localeFromEnv("en_GB")).toBe("en");
    expect(localeFromEnv("en")).toBe("en");
  });

  test("falls back to the default for unset, C/POSIX, or unsupported languages", () => {
    expect(localeFromEnv(undefined)).toBe("en");
    expect(localeFromEnv("")).toBe("en");
    expect(localeFromEnv("C")).toBe("en");
    expect(localeFromEnv("POSIX")).toBe("en");
    expect(localeFromEnv("fr_FR.UTF-8")).toBe("en");
  });
});
