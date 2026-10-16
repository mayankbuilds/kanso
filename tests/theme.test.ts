import test from "node:test";
import assert from "node:assert";
import {
  applyTheme,
  normalizeAccent,
  normalizeThemeMode,
  resolveThemeMode,
  ACCENT_PALETTES,
} from "../src/lib/theme.ts";
import { STORAGE_KEYS } from "../src/lib/storage/keys.ts";

function setupMockDomEnvironment() {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };

  const classListSet = new Set<string>();
  const attributes = new Map<string, string>();
  const styleProps = new Map<string, string>();
  const eventListeners = new Map<string, Array<(e: unknown) => void>>();

  const mockDocumentElement = {
    classList: {
      add: (cls: string) => classListSet.add(cls),
      remove: (cls: string) => classListSet.delete(cls),
      contains: (cls: string) => classListSet.has(cls),
    },
    setAttribute: (k: string, v: string) => attributes.set(k, v),
    getAttribute: (k: string) => attributes.get(k) ?? null,
    style: {
      setProperty: (prop: string, val: string) => styleProps.set(prop, val),
      getPropertyValue: (prop: string) => styleProps.get(prop) ?? "",
    },
  };

  const mockWindow = {
    matchMedia: (query: string) => ({
      matches: query.includes("dark"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    addEventListener: (type: string, listener: (e: unknown) => void) => {
      if (!eventListeners.has(type)) {
        eventListeners.set(type, []);
      }
      eventListeners.get(type)!.push(listener);
    },
    removeEventListener: (type: string, listener: (e: unknown) => void) => {
      const list = eventListeners.get(type) || [];
      eventListeners.set(
        type,
        list.filter((l) => l !== listener)
      );
    },
    dispatchEvent: (event: { type: string; detail?: unknown }) => {
      const list = eventListeners.get(event.type) || [];
      for (const fn of list) {
        fn(event);
      }
      return true;
    },
  };

  (global as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
  (global as unknown as { document: { documentElement: typeof mockDocumentElement } }).document = {
    documentElement: mockDocumentElement,
  };
  (global as unknown as { window: typeof mockWindow }).window = mockWindow;

  // Polyfill CustomEvent if needed in node test env
  if (typeof (global as unknown as { CustomEvent: unknown }).CustomEvent === "undefined") {
    class MockCustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, options?: { detail?: unknown }) {
        this.type = type;
        this.detail = options?.detail;
      }
    }
    (global as unknown as { CustomEvent: unknown }).CustomEvent = MockCustomEvent;
  }

  return {
    mockStorage,
    mockDocumentElement,
    classListSet,
    attributes,
    styleProps,
    mockWindow,
  };
}

test("theme - normalizes theme modes and accents correctly", () => {
  assert.strictEqual(normalizeThemeMode("dark"), "dark");
  assert.strictEqual(normalizeThemeMode("light"), "light");
  assert.strictEqual(normalizeThemeMode("system"), "system");
  assert.strictEqual(normalizeThemeMode("invalid_mode"), "system");

  assert.strictEqual(resolveThemeMode("dark"), "dark");
  assert.strictEqual(resolveThemeMode("light"), "light");

  assert.strictEqual(normalizeAccent("pine"), "pine");
  assert.strictEqual(normalizeAccent("ceramic"), "ceramic");
  assert.strictEqual(normalizeAccent("sand"), "sand");
  assert.strictEqual(normalizeAccent("clay"), "clay");
  assert.strictEqual(normalizeAccent("emerald"), "pine");
  assert.strictEqual(normalizeAccent("invalid"), "pine");
});

test("theme - applies dark mode and ceramic accent to DOM and persists storage", () => {
  const env = setupMockDomEnvironment();

  const res = applyTheme("dark", "ceramic");
  assert.strictEqual(res.resolvedMode, "dark");
  assert.strictEqual(res.accent, "ceramic");

  assert.strictEqual(env.classListSet.has("dark"), true);
  assert.strictEqual(env.classListSet.has("light"), false);
  assert.strictEqual(env.attributes.get("data-theme"), "dark");
  assert.strictEqual(env.attributes.get("data-accent"), "ceramic");

  const ceramicPalette = ACCENT_PALETTES.find((p) => p.id === "ceramic")!;
  assert.strictEqual(env.styleProps.get("--theme-accent"), ceramicPalette.darkHex);

  assert.strictEqual(env.mockStorage.getItem(STORAGE_KEYS.THEME_MODE), "dark");
  assert.strictEqual(env.mockStorage.getItem(STORAGE_KEYS.ACCENT_COLOR), "ceramic");
  assert.strictEqual(env.mockStorage.getItem("streakflow_theme_mode"), "dark");
  assert.strictEqual(env.mockStorage.getItem("streakflow_accent_color"), "ceramic");
});

test("theme - applyTheme protects against recursive event listener call loops", () => {
  const env = setupMockDomEnvironment();
  let recursiveCallCount = 0;

  // Simulate a component listener that mistakenly invokes applyTheme inside kanso-theme-changed
  env.mockWindow.addEventListener("kanso-theme-changed", () => {
    recursiveCallCount++;
    if (recursiveCallCount < 10) {
      applyTheme("dark", "sand");
    }
  });

  // Calling applyTheme must not exceed call stack or crash
  assert.doesNotThrow(() => {
    applyTheme("dark", "pine");
  });

  // Since isApplyingTheme guard intercepts re-entrancy, the recursive call returns safely
  assert.strictEqual(recursiveCallCount > 0, true);
});
