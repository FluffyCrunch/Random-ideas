// Runs after `vite build`: scrambles the game's own code in dist/ so it isn't readable in the browser.
// The libraries (vendor-*.js) are left alone.
//
// This makes the code hard to read or copy, but it can't make it secret: a browser has to download
// the code in order to run the game, so a determined person can always dig through it.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JavaScriptObfuscator from 'javascript-obfuscator';

const dir = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const files = readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('vendor'));
if (!files.length) throw new Error('No game code found in dist/assets: did the build run?');

for (const file of files) {
  const path = join(dir, file);
  const before = readFileSync(path, 'utf8');
  const after = JavaScriptObfuscator.obfuscate(before, {
    target: 'browser',
    ignoreImports: true,                 // keep the import lines that load the libraries
    compact: true,
    simplify: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    renameProperties: false,             // safer: property names are shared with the libraries
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.8,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    numbersToExpressions: true,
    splitStrings: false,
    controlFlowFlattening: false,        // slows the game loop down too much
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
    disableConsoleOutput: true,
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();
  writeFileSync(path, after);
  console.log(`scrambled ${file}: ${(before.length / 1024).toFixed(0)} KB -> ${(after.length / 1024).toFixed(0)} KB`);
}
