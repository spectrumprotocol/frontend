export function flatMap<T, U>(array: T[], selector: (item: T) => U[]) {
  return array.map(selector).reduce((a, b) => a.concat(b), []);
}
