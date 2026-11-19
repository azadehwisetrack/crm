import { api } from './api.js';

let map = null;
let loading = null;

export function loadLookups() {
  if (map) return Promise.resolve(map);
  if (!loading) {
    loading = api.lookups({ quiet: true }).then((rows) => {
      map = {};
      for (const r of rows) (map[r.kind] ||= {})[r.key] = r;
      return map;
    }).finally(() => { loading = null; });
  }
  return loading;
}

export const resetLookups = () => { map = null; };
// Label for a lookup key; falls back to the raw value (e.g. free-text reasons from #lost tags).
export const label = (kind, key) => (key == null || key === '' ? '' : (map?.[kind]?.[key]?.label ?? key));
export const options = (kind) => Object.values(map?.[kind] || {}).filter((r) => r.active).sort((a, b) => a.sort - b.sort);
