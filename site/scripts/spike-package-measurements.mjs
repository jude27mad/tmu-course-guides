// R4 only. Run from site/: node scripts/spike-package-measurements.mjs
// Reads the installed packages and writes source observations, not browser results.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(site, '../docs/codex/remove-repetition/reports/r4-evidence/packages.json');
const packageNames = [
  '@schedule-x/react',
  '@schedule-x/calendar',
  '@schedule-x/calendar-controls',
  '@schedule-x/events-service',
  '@schedule-x/theme-default',
  'temporal-polyfill',
  'preact',
  '@preact/signals',
  '@radix-ui/react-accordion',
];
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const packages = await Promise.all(
  packageNames.map(async (name) => {
    const root = join(site, 'node_modules', name);
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const licenseFilename = (await readdir(root)).find((filename) => /^licen[sc]e(?:\..*)?$/i.test(filename));
    if (!licenseFilename) throw new Error(`No LICENSE file found for ${name}`);
    const licenseText = await readFile(join(root, licenseFilename), 'utf8');
    const isMit =
      licenseText.includes('Permission is hereby granted, free of charge') &&
      licenseText.includes('The above copyright notice and this permission notice') &&
      licenseText.includes('THE SOFTWARE IS PROVIDED "AS IS"');
    return {
      name,
      version: manifest.version,
      declaredLicense: manifest.license,
      licenseReadFromFile: isMit ? 'MIT' : 'UNCLASSIFIED — inspect licenseText',
      licenseFile: `site/node_modules/${name}/${licenseFilename}`,
      licenseSha256: sha256(licenseText),
      copyright: licenseText.split('\n').filter((line) => /copyright/i.test(line) && !/above|holders/i.test(line)),
      licenseText,
      peerDependencies: manifest.peerDependencies || {},
    };
  }),
);

function npmLs(args, includeFullOutput = false) {
  const result = spawnSync('npm', ['ls', ...args], { cwd: site, encoding: 'utf8' });
  const combined = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    command: `npm ls ${args.join(' ')}`,
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.message || null,
    stderr: result.stderr || '',
    warningLines: combined.split('\n').filter((line) => /warn|error|invalid|missing|extraneous|UNMET/i.test(line)),
    ...(includeFullOutput ? { stdout: result.stdout || '' } : {}),
  };
}

const themeRoot = join(site, 'node_modules/@schedule-x/theme-default/dist');
const cssFiles = (await readdir(themeRoot)).filter((filename) => filename.endsWith('.css')).sort();
const themeExports = await Promise.all(
  cssFiles.map(async (filename) => {
    const source = await readFile(join(themeRoot, filename), 'utf8');
    const definitions = [...source.matchAll(/(--sx-[\w-]+)\s*:\s*([^;}]+);/g)].map((match) => {
      const open = source.lastIndexOf('{', match.index);
      const start = Math.max(source.lastIndexOf('}', open - 1), source.lastIndexOf('{', open - 1));
      return {
        name: match[1],
        value: match[2].replace(/\s+/g, ' ').trim(),
        selector: source.slice(start + 1, open).trim(),
        file: `site/node_modules/@schedule-x/theme-default/dist/${filename}`,
        line: source.slice(0, match.index).split('\n').length,
      };
    });
    return { filename, sha256: sha256(source), bytes: Buffer.byteLength(source), definitions, referenced: [...source.matchAll(/var\(\s*(--sx-[\w-]+)/g)].map((match) => match[1]) };
  }),
);
const cssSources = Object.fromEntries(themeExports.map(({ filename, sha256: hash, bytes }) => [filename, { sha256: hash, bytes }]));
const definitions = themeExports.flatMap((entry) => entry.definitions);
const referenced = new Set(themeExports.flatMap((entry) => entry.referenced));
const definedNames = [...new Set(definitions.map(({ name }) => name))].sort();
const theme = {
  cssSources,
  definedNames,
  definedCount: definedNames.length,
  // index.css is the imported calendar/date-picker theme. The separately
  // exported time-picker.css defines one additional variable.
  indexDefinitions: definitions.filter(({ file }) => file.endsWith('/index.css')),
  allExportDefinitions: definitions,
  referencedOnly: [...referenced].filter((name) => !definedNames.includes(name)).sort(),
};

const calendarPath = 'site/node_modules/@schedule-x/calendar/dist/core.js';
const calendar = await readFile(resolve(site, '..', calendarPath), 'utf8');
const lines = calendar.split('\n');
const excerpt = (anchor, length) => {
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index < 0) throw new Error(`Source anchor missing: ${anchor}`);
  return { file: calendarPath, firstLine: index + 1, lastLine: index + length, text: lines.slice(index, index + length).join('\n') };
};
const sourceObservations = {
  classification: 'Installed-source observations only; verify behavior in the browser separately.',
  file: calendarPath,
  sha256: sha256(calendar),
  responsive: {
    finding:
      'Uses calendarWrapper.clientWidth against a root-font-relative 43.75rem threshold (700px at 16px root). Runs once when mounted and on window.resize only; no container ResizeObserver drives this check. A callbacks.isCalendarSmall hook overrides the size predicate.',
    excerpts: [excerpt('const handleWindowResize =', 25), excerpt('const onResize = () => {', 12), excerpt('const setScreenSizeCompatibleView =', 22)],
  },
  viewPicker: {
    finding:
      'Picker filters by hasSmallScreenCompat when isCalendarSmall, otherwise by hasWideScreenCompat. isResponsive:false disables the responsive observer, not this picker filtering. Month-grid is wide-only; month-agenda is small-only; Day supports both; Week is wide-only.',
    excerpts: [excerpt('function ViewSelection()', 15), excerpt('const config$4 = {', 10), excerpt('const config$3 = {', 10)],
  },
  plusEvents: {
    finding:
      'Default nEventsPerDay is 4. More control calls callbacks.onClickPlusEvents(date,event) when supplied and returns immediately; otherwise it switches to configured Day view after 250ms. Without a configured Day view it does nothing. monthGridOptions.nEventsPerDay controls the number initially rendered.',
    excerpts: [excerpt('const handleClickAdditionalEvents =', 18), excerpt('constructor(locale = DEFAULT_LOCALE', 5)],
  },
  multiDayEnd: {
    finding: 'All-day end is inclusive in month-grid (<= lastDateOfEvent) and month-agenda (getAllEventDates includes end). A Monday–Friday span ends on Friday, not Saturday.',
    excerpts: [excerpt('const positionInMonthWeek =', 30), excerpt('const getAllEventDates =', 17)],
  },
};

const data = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  packages,
  react: JSON.parse(await readFile(join(site, 'node_modules/react/package.json'), 'utf8')).version,
  reactDom: JSON.parse(await readFile(join(site, 'node_modules/react-dom/package.json'), 'utf8')).version,
  npmLs: {
    selected: npmLs(['react', 'react-dom', ...packageNames], true),
    all: npmLs(['--all']),
  },
  theme,
  sourceObservations,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wrote ${output}`);
console.log(`${packages.length} package LICENSE files read; ${theme.definedCount} unique --sx-* variables defined.`);
console.log(`npm ls selected exit ${data.npmLs.selected.exitCode}; npm ls --all exit ${data.npmLs.all.exitCode}`);
