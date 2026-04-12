// Polyfill browser DOM APIs used by @ifc-lite/ids's XML parser.
// ifc-lite's IDS module calls `new DOMParser().parseFromString(...)` and then
// `doc.querySelector(...)`, both of which are browser-only. linkedom provides
// a Node-compatible implementation that supports querySelector.
import { DOMParser } from "linkedom";
globalThis.DOMParser = DOMParser;
