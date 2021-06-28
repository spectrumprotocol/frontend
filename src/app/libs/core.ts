export function fromEntries<T>(entries: [string, T][]) {
    return entries.reduce((a, [k, v]) => (a[k] = v, a), {} as Record<string, T>);
}
