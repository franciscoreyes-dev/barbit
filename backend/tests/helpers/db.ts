import { vi } from 'vitest'

export function mockDb(rows: Record<string, unknown[]> = {}) {
  const query = vi.fn().mockImplementation((sql: string) => {
    for (const [key, data] of Object.entries(rows)) {
      if (sql.includes(key)) {
        return Promise.resolve({ rows: data, rowCount: data.length })
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 })
  })
  return { query }
}
