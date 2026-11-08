import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it, test } from 'node:test';
import { globSync } from 'glob';
import { encode, decode } from './index.js';

const forms = ['NFC', 'NFD', 'NFKC', 'NFKD'];

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

test('string input to encode is treated as UTF-8', () => {
  assert.equal(encode('abc'), encode(new TextEncoder().encode('abc')));
});

test('throws on invalid character', () => {
  assert.throws(() => decode('notbase65536'), /Unrecognised Base65536 character/);
});

test('throws if an 8-bit character is not the last character', () => {
  // 'ᔀ' is a valid 8-bit (final-only) character
  assert.throws(() => decode('ᔀ㔀'), /Secondary character found before end of input/);
  assert.throws(() => decode('ᔀᔀ'), /Secondary character found before end of input/);
  assert.deepEqual(decode('㔀ᔀ'), Uint8Array.from([0x00, 0x01, 0x00]));
});

describe('base65536-test suite', () => {
  describe('success cases', () => {
    for (const fileName of globSync('./node_modules/base65536-test/data/pairs/**/*.bin')) {
      const caseName = fileName.slice(0, -'.bin'.length);
      it(caseName, () => {
        const uint8Array = new Uint8Array(fs.readFileSync(caseName + '.bin'));
        const text = fs.readFileSync(caseName + '.txt', 'utf8');
        assert.equal(encode(uint8Array), text);
        assert.deepEqual(decode(text), uint8Array);
        for (const form of forms) {
          assert.equal(text.normalize(form), text);
        }
      });
    }
  });

  describe('failure cases', () => {
    for (const fileName of globSync('./node_modules/base65536-test/data/bad/**/*.txt')) {
      const caseName = fileName.slice(0, -'.txt'.length);
      it(caseName, () => {
        const text = fs.readFileSync(caseName + '.txt', 'utf8');
        assert.throws(() => decode(text));
      });
    }
  });

  describe('round trips at all lengths', () => {
    for (let length = 0; length < 256; length++) {
      for (const fill of [0b00000000, 0b00000001, 0b01010101, 0b10101010, 0b11111111]) {
        it(`every uint8 is ${fill} to length ${length}`, () => {
          const uint8Array = new Uint8Array(length).fill(fill);
          assert.deepEqual(decode(encode(uint8Array)), uint8Array);
        });
      }
    }
  });
});
