// unicode-coverage.mjs
// Node 24+, macOS only. Usage examples below.

import { execFile as _execFile } from 'node:child_process';
import { writeFile, appendFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { EOL } from 'node:os';
const execFile = promisify(_execFile);

if (process.platform !== 'darwin') {
  console.error('This script requires macOS (CoreText via osascript).');
  process.exit(1);
}

const args = new Map(process.argv.slice(2).flatMap(a => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  return m ? [[m[1], m[2]]] : [];
}));

const start = parseInt(args.get('start') ?? '0', 10);
const end   = parseInt(args.get('end')   ?? String(0x10FFFF), 16);
const batch = parseInt(args.get('batch') ?? '4096', 10);
const out   = args.get('out') ?? 'unicode_coverage.csv';

// CSV header
await writeFile(out, `codepoint_hex,codepoint_dec,supported,font\n`, 'utf8');

// One JXA (JavaScript for Automation) program, fed start/end each batch.
const JXA = String.raw`
ObjC.import('CoreText');
ObjC.import('AppKit');
ObjC.import('Foundation');

(function() {
  const args = $.NSProcessInfo.processInfo.arguments;
  const argc = args.count;
  // last two args are start,end (integers)
  const start = parseInt(ObjC.unwrap(args.objectAtIndex(argc - 2)));
  const end   = parseInt(ObjC.unwrap(args.objectAtIndex(argc - 1)));

  // Base font = system font, size 12
  const sys = $.NSFont.systemFontOfSize(12);
  const base = $.CTFontCreateWithName(sys.fontName, 12, null);

  const out = [];
  for (let cp = start; cp <= end; cp++) {
    // Skip non-characters and surrogate code points explicitly
    if ((cp & 0xFFFF) >= 0xFFFE) { // U+xxFFFE/FFFD/FFFF nonchars
      continue;
    }
    if (cp >= 0xD800 && cp <= 0xDFFF) {
      continue;
    }

    const js = String.fromCodePoint(cp);
    const ns = ObjC.wrap(js); // NSString*
    // Ask CoreText which specific font would render this char in the cascade
    const f = $.CTFontCreateForString(base, ns, $.CFRangeMake(0, ns.length));
    // If null, definitely unsupported (very rare); otherwise check LastResort
    let ps = ".LastResort";
    if (f) {
      const name = $.CTFontCopyPostScriptName(f);
      ps = name ? ObjC.unwrap(name) : ".LastResort";
    }
    const supported = (ps !== ".LastResort");
    out.push([cp.toString(16).toUpperCase(), String(cp), supported ? '1' : '0', ps].join(','));
  }

  // Print CSV rows to stdout
  out.join('\\n'); // implicit return in IIFE -> osascript prints it via console.log equivalent
})();
`;

async function probeRange(s, e) {
  const { stdout } = await execFile(
    '/usr/bin/osascript',
    ['-l', 'JavaScript', '-e', JXA, String(s), String(e)],
    { maxBuffer: 1024 * 1024 * 128 } // 128MB, large enough for a batch
  );
  const trimmed = String(stdout || '').trim();
  if (!trimmed) return;
  // Ensure trailing newline for CSV append
  await appendFile(out, trimmed + EOL, 'utf8');
}

async function main() {
  console.time('scan');
  for (let s = start; s <= end; s += batch) {
    const e = Math.min(eu(end), s + batch - 1);
    await probeRange(s, e);
    // light progress indicator
    if (((s - start) / batch) % 50 === 0) {
      process.stderr.write(`\r… ${e.toString(16).toUpperCase()}`);
    }
  }
  console.timeEnd('scan');
  process.stderr.write(`\nWrote ${out}\n`);
}
const eu = x => x; // tiny helper to keep code tidy

main().catch(err => {
  console.error(err?.stack || err);
  process.exit(1);
});