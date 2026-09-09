// Polyfill Web Storage for the test environment.
// jsdom 29 + Node 25 does not provide a working `localStorage`/`sessionStorage`
// (the global resolves to a plain object with no `getItem`/`setItem`/`clear`).
// Install a minimal in-memory Storage so pure-function tests that touch
// localStorage behave like a browser.

function makeStorage(): Storage {
  const store = new Map<string, string>();
  const api: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };
  return api;
}

function isBroken(candidate: unknown): boolean {
  return (
    !candidate ||
    typeof (candidate as Storage).setItem !== 'function' ||
    typeof (candidate as Storage).clear !== 'function'
  );
}

for (const target of [globalThis, globalThis.window].filter(Boolean) as Array<typeof globalThis>) {
  let ls: unknown;
  try {
    ls = target.localStorage;
  } catch {
    ls = undefined;
  }
  if (isBroken(ls)) {
    Object.defineProperty(target, 'localStorage', {
      value: makeStorage(),
      configurable: true,
      writable: false,
    });
  }
  let ss: unknown;
  try {
    ss = target.sessionStorage;
  } catch {
    ss = undefined;
  }
  if (isBroken(ss)) {
    Object.defineProperty(target, 'sessionStorage', {
      value: makeStorage(),
      configurable: true,
      writable: false,
    });
  }
}
