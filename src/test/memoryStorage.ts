/** A small in-memory stand-in for the browser's localStorage. */
export function memoryStorage(options: { failWrites?: boolean; failReads?: boolean } = {}): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    getItem: key => { if (options.failReads) throw new Error('blocked'); return values.get(key) ?? null },
    setItem: (key, value) => { if (options.failWrites) throw new Error('full'); values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
}
