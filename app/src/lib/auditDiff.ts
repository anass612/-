export interface FieldChange {
  key: string
  before: unknown
  after: unknown
}

export function diffFields(oldRow: Record<string, unknown> | null, newRow: Record<string, unknown> | null): FieldChange[] {
  const keys = new Set([...(oldRow ? Object.keys(oldRow) : []), ...(newRow ? Object.keys(newRow) : [])])
  const changed: FieldChange[] = []
  for (const key of keys) {
    const before = oldRow?.[key]
    const after = newRow?.[key]
    if (JSON.stringify(before) !== JSON.stringify(after)) changed.push({ key, before, after })
  }
  return changed
}
