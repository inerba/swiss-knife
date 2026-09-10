const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');

const root = path.resolve(__dirname, '..');
const packagePath = path.join(root, 'package.json');
const wxtBin = path.join(root, 'node_modules', 'wxt', 'bin', 'wxt.mjs');

function isChromeExtensionVersion(value) {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split('.');
  if (parts.length < 1 || parts.length > 4) return false;
  return parts.every(part => {
    if (!/^(0|[1-9]\d*)$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 65535;
  });
}

function parseCliVersion(argv) {
  const args = argv.slice(2).filter(arg => arg !== '--');
  if (args.includes('-h') || args.includes('--help')) return { help: true };
  const version = args.find(arg => !arg.startsWith('-'));
  return { version: version || '' };
}

function readPackage() {
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

function writePackageVersion(pkg, version) {
  const next = { ...pkg, version };
  fs.writeFileSync(packagePath, `${JSON.stringify(next, null, 2)}\n`);
}

function printHelp(current) {
  process.stdout.write(`Crea lo ZIP installabile di Swiss Knife in .output.

Uso:
  pnpm zip
  pnpm zip -- ${current}
  node scripts/zip.cjs ${current}

Senza argomento, se il terminale è interattivo, chiede la versione.
La versione finisce in package.json e nel manifest Chrome (1–4 numeri, 0–65535).
`);
}

async function askVersion(current) {
  if (!process.stdin.isTTY) {
    throw new Error(`Passa la versione come argomento, ad esempio: pnpm zip -- ${current}`);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`Versione [${current}]: `)).trim();
    return answer || current;
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseCliVersion(process.argv);
  const pkg = readPackage();
  const current = typeof pkg.version === 'string' && pkg.version ? pkg.version : '0.0.0';
  if (parsed.help) {
    printHelp(current);
    return;
  }
  const version = parsed.version || await askVersion(current);
  if (!isChromeExtensionVersion(version)) {
    throw new Error(`Versione non valida: «${version}». Usa ad esempio 1.2.0 (1–4 numeri, ciascuno 0–65535).`);
  }
  if (version !== current) writePackageVersion(pkg, version);
  if (!fs.existsSync(wxtBin)) throw new Error('WXT non è installato. Esegui pnpm install.');
  const result = spawnSync(process.execPath, ['--no-experimental-webstorage', wxtBin, 'zip'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
  const zipName = `swiss-knife-${version}-chrome.zip`;
  process.stdout.write(`\nZIP pronto: ${path.join('.output', zipName)}\nCaricalo da chrome://extensions con «Carica estensione non pacchettizzata» dopo averlo scompattato, oppure tieni lo ZIP per la consegna.\n`);
}

module.exports = { isChromeExtensionVersion, parseCliVersion, writePackageVersion };

if (require.main === module) {
  void main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  });
}
