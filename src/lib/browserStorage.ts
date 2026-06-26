function readFromStorage(storage: Storage | undefined, key: string): string | null {
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    // Privacy settings or browser extensions can deny storage access at read time.
    return null;
  }
}

function writeToStorage(storage: Storage | undefined, key: string, value: string): void {
  if (!storage) return;

  try {
    storage.setItem(key, value);
  } catch {
    // Swallow persistence failures so the current UI interaction can still complete in memory.
  }
}

function removeFromStorage(storage: Storage | undefined, key: string): void {
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // Cleanup should never be able to take down the flow that triggered it.
  }
}

export function safeLocalStorageGetItem(key: string): string | null {
  return typeof localStorage === "undefined" ? null : readFromStorage(localStorage, key);
}

export function safeLocalStorageSetItem(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  writeToStorage(localStorage, key, value);
}

export function safeLocalStorageRemoveItem(key: string): void {
  if (typeof localStorage === "undefined") return;
  removeFromStorage(localStorage, key);
}

export function safeSessionStorageGetItem(key: string): string | null {
  return typeof sessionStorage === "undefined" ? null : readFromStorage(sessionStorage, key);
}

export function safeSessionStorageSetItem(key: string, value: string): void {
  if (typeof sessionStorage === "undefined") return;
  writeToStorage(sessionStorage, key, value);
}

export function safeSessionStorageRemoveItem(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  removeFromStorage(sessionStorage, key);
}
