/**
 * Routines for converting binary data into text data which can be sent safely
 * through 'Unicode-clean' text systems without information being lost. Analogous
 * to Base64 with a significantly larger character repertoire enabling the
 * encoding of 2.00 bytes per character (for comparison, Base64 manages 0.75 bytes
 * per character).
 */

// Z is a number, usually a uint16 but sometimes a uint8

const BITS_PER_CHAR = 16; // Base65536 is an 16-bit encoding
const BITS_PER_BYTE = 8;

// Compressed representation of inclusive-exclusive ranges of characters used in this encoding.
const pairStrings = ['㐀䳿一黿ꄀꏿꔀꗿ𐘀𐛿𒀀𒋿𓀀𓏿𔐀𔗿𖠀𖧿𠀀𨗿', 'ᔀᗿ'];

// Decompression
const lookupE = {};
const lookupD = {};
pairStrings.forEach((pairString, r) => {
  const numZBits = BITS_PER_CHAR - BITS_PER_BYTE * r; // 0 -> 16, 1 -> 8
  lookupE[numZBits] = {};
  let z2 = 0;
  pairString.match(/../gu).forEach(pair => {
    const [first, last] = [...pair].map(x => x.codePointAt(0));
    for (let codePoint = first; codePoint <= last; codePoint++) {
      const chr = String.fromCodePoint(codePoint);

      // SPECIAL CASE: flip the bytes around, because Base65536 was constructed to take the bytes
      // in the wrong order originally
      const z = numZBits === BITS_PER_CHAR ? 256 * (z2 % 256) + (z2 >> 8) : z2;
      lookupE[numZBits][z] = chr;
      lookupD[chr] = [numZBits, z];
      z2++;
    }
  });
});

const encode = (uint8Array) => {
  // If input is a string, convert to Uint8Array
  if (typeof uint8Array === 'string') {
    const encoder = new TextEncoder();
    uint8Array = encoder.encode(uint8Array);
  }
  const length = uint8Array.length;
  const out = [];
  let i = 0;
  // Process pairs of bytes
  for (; i + 1 < length; i += 2) {
    const z = (uint8Array[i] << 8) | uint8Array[i + 1];
    out.push(lookupE[16][z]);
  }
  // Handle final odd byte
  if (i < length) {
    out.push(lookupE[8][uint8Array[i]]);
  }
  return out.join('');
};

const decode = (str) => {
  const out = [];
  for (const chr of str) {
    if (!(chr in lookupD)) throw new Error('Unrecognised Base65536 character: ' + chr);
    const [numZBits, z] = lookupD[chr];
    if (numZBits === 16) {
      out.push(z >> 8, z & 0xff);
    } else if (numZBits === 8) {
      out.push(z);
    } else {
      throw new Error('Invalid code point length');
    }
  }
  return new Uint8Array(out);
};

export {encode, decode};
