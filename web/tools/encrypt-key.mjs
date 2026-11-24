// Encrypt the course API key with the course password → web/public/data/course-key.json
// (AES-256-GCM, key from PBKDF2-SHA256, 600k iterations). The static site decrypts it in the browser after login.
// Anyone who has the password can recover the key: use a dedicated key with a spend limit and rotate it after the course.
// Usage: KEY_FILE=/path/to/key COURSE_PASSWORD='…' node tools/encrypt-key.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const { subtle } = globalThis.crypto;
const key = readFileSync(process.env.KEY_FILE, 'utf8').trim();
const pw = process.env.COURSE_PASSWORD;
if (!/^sk-ant-/.test(key) || !pw || pw.length < 6) { console.error('need KEY_FILE (sk-ant-…) and COURSE_PASSWORD (≥ 6 chars)'); process.exit(2); }
const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 600000;
const base = await subtle.importKey('raw', new TextEncoder().encode(pw.normalize('NFC').toLowerCase()), 'PBKDF2', false, ['deriveKey']);
const aes = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(key)));
const b64 = (u) => Buffer.from(u).toString('base64');
const out = new URL('../public/data/course-key.json', import.meta.url);
writeFileSync(out, JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), ct: b64(ct), course: 'BFH Minor BXMid03 HS26', created: new Date().toISOString().slice(0, 10) }, null, 1));
console.log('wrote', out.pathname);
