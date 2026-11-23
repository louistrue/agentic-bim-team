// Stable, spec-valid IFC GlobalIds derived from a design key (UUID v5-style over SHA-1).
import { createHash } from 'node:crypto';
import { uuidToIfcGuid } from '@ifc-lite/bcf';
const NS = 'agentic-bim-team/loorenstrasse';
export function stableUuid(key) {
  const h = createHash('sha1').update(`${NS}:${key}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
export const stableGuid = (key) => uuidToIfcGuid(stableUuid(key));
