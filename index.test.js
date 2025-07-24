import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encode, decode } from './index.js';

// Test round-trip for ASCII

test('round-trip ASCII', () => {
  const ascii = 'Hello, father, wow, cool!';
  const uint8Array = Uint8Array.from(ascii, chr => chr.charCodeAt(0));
  const str = encode(uint8Array);
  const uint8Array2 = decode(str);
  const ascii2 = String.fromCharCode(...uint8Array2);
  assert.equal(ascii2, ascii);
});

test('known value encode', () => {
  const input = Uint8Array.from([0x00, 0x01, 0x02]);
  const expected = '㔀ᔂ';
  assert.equal(encode(input), expected);
});

test('known value decode', () => {
  const input = '㔀ᔂ';
  const expected = Uint8Array.from([0x00, 0x01, 0x02]);
  assert.deepEqual(decode(input), expected);
});

test('empty input', () => {
  assert.equal(encode(new Uint8Array([])), '');
  assert.deepEqual(decode(''), new Uint8Array([]));
});

test('throws on invalid character', () => {
  assert.throws(() => decode('notbase65536'), /Unrecognised Base65536 character/);
});