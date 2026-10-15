import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { iconPaths } from '../src/components/icons/iconPaths.js';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'src');
const exported = readFileSync(path.join(source, 'components/icons/index.jsx'), 'utf8');
const sprite = readFileSync(path.join(root, 'public/novelhub-icons.svg'), 'utf8');
const used = new Set();
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      check(file);
      continue;
    }
    if (!/\.(jsx|js)$/.test(file)) continue;
    const content = readFileSync(file, 'utf8');
    assert.ok(!content.includes("from 'lucide-react'"), `Unmigrated icon dependency: ${file}`);
    for (const [, names] of content.matchAll(
      /import\s*\{([^}]+)\}\s*from\s*['"][^'"]*\/icons['"]/g,
    )) {
      for (const name of names
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)) {
        assert.ok(iconPaths[name], `Missing drawing: ${name} in ${file}`);
        assert.ok(exported.includes(`export const ${name} =`), `Missing React component: ${name}`);
        used.add(name);
      }
    }
  }
}
check(source);
for (const [name, drawing] of Object.entries(iconPaths)) {
  assert.ok(
    sprite.includes(`id="${name}" viewBox="0 0 24 24"><path d="${drawing}"`),
    `Sprite differs from original drawing: ${name}`,
  );
}
for (const file of ['favicon.svg', 'novelhub-mark.svg']) {
  assert.ok(
    readFileSync(path.join(root, 'public', file), 'utf8').includes(iconPaths.NovelHubMark),
    `Brand mark mismatch: ${file}`,
  );
}

// Live area: every stroke centre line stays inside 2..22 of the 24-unit viewBox, so round
// caps/joins of any stroke up to 3 units keep ≥0.5 unit clear of the clipping <svg> edge.
const LIVE_MIN = 2;
const LIVE_MAX = 22;
const EPSILON = 1e-6;
// Authored coordinates carry two decimals; allow that rounding at the live-area edge.
const TOLERANCE = 0.01;
const ARGUMENTS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokenize(d) {
  const tokens = [];
  let index = 0;
  let command = null;
  let argument = 0;
  const number = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;
  while (index < d.length) {
    const char = d[index];
    if (/[\s,]/.test(char)) {
      index += 1;
    } else if (/[a-z]/i.test(char)) {
      command = char;
      argument = 0;
      assert.ok(ARGUMENTS[char.toUpperCase()] !== undefined, `Unknown path command: ${char}`);
      tokens.push(char);
      index += 1;
    } else {
      // Arc flags (4th and 5th arc arguments) are single digits and may be packed: "a9 9 0 1118 0".
      const flag = command?.toUpperCase() === 'A' && (argument % 7 === 3 || argument % 7 === 4);
      const match = flag ? /^[01]/.exec(d.slice(index)) : number.exec(d.slice(index));
      assert.ok(match, `Malformed path data near "${d.slice(index, index + 12)}"`);
      tokens.push(Number(match[0]));
      index += match[0].length;
      argument += 1;
    }
  }
  return tokens;
}

function cubicExtrema(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const roots = [];
  if (Math.abs(a) < EPSILON) {
    if (Math.abs(b) > EPSILON) roots.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      roots.push((-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a));
    }
  }
  return roots
    .filter((t) => t > 0 && t < 1)
    .map(
      (t) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3,
    );
}

function quadraticExtrema(p0, p1, p2) {
  const denominator = p0 - 2 * p1 + p2;
  if (Math.abs(denominator) < EPSILON) return [];
  const t = (p0 - p1) / denominator;
  return t > 0 && t < 1 ? [(1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2] : [];
}

// Endpoint → centre parameterisation (SVG 2, appendix B.2.4); exact extremes within the sweep.
function arcPoints(x1, y1, rx, ry, rotation, large, sweep, x2, y2) {
  if ((x1 === x2 && y1 === y2) || !rx || !ry) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const point = (theta) => [
    cx + rx * cos * Math.cos(theta) - ry * sin * Math.sin(theta),
    cy + rx * sin * Math.cos(theta) + ry * cos * Math.sin(theta),
  ];
  const candidates = [Math.atan2(-ry * sin, rx * cos), Math.atan2(ry * cos, rx * sin)].flatMap(
    (theta) => [theta, theta + Math.PI],
  );
  const points = [];
  for (const theta of candidates) {
    const offset =
      ((((theta - start) * Math.sign(delta)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (offset < Math.abs(delta)) points.push(point(theta));
  }
  return points;
}

function pathBounds(d) {
  const tokens = tokenize(d);
  const points = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let controlX = 0;
  let controlY = 0;
  let previous = '';
  let index = 0;
  let command = '';
  while (index < tokens.length) {
    if (typeof tokens[index] === 'string') command = tokens[index++];
    const upper = command.toUpperCase();
    const relative = command !== upper;
    const args = tokens.slice(index, index + ARGUMENTS[upper]);
    assert.ok(
      args.length === ARGUMENTS[upper] && args.every((value) => typeof value === 'number'),
      `Missing arguments for ${command}`,
    );
    index += args.length;
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    const reflect = (types) =>
      types.includes(previous) ? [2 * x - controlX, 2 * y - controlY] : [x, y];
    let nx = x;
    let ny = y;
    switch (upper) {
      case 'M':
      case 'L':
      case 'T': {
        nx = ox + args[0];
        ny = oy + args[1];
        if (upper === 'T') {
          [controlX, controlY] = reflect(['Q', 'T']);
          points.push(
            ...quadraticExtrema(x, controlX, nx).map((value) => [value, ny]),
            ...quadraticExtrema(y, controlY, ny).map((value) => [nx, value]),
          );
        }
        if (upper === 'M') {
          [startX, startY] = [nx, ny];
          // Further coordinate pairs after a moveto are linetos.
          command = relative ? 'l' : 'L';
        }
        break;
      }
      case 'H':
        nx = ox + args[0];
        break;
      case 'V':
        ny = oy + args[0];
        break;
      case 'Z':
        [nx, ny] = [startX, startY];
        break;
      case 'C':
      case 'S':
      case 'Q': {
        let c1;
        let rest;
        if (upper === 'S') {
          c1 = reflect(['C', 'S']);
          rest = args;
        } else {
          c1 = [ox + args[0], oy + args[1]];
          rest = args.slice(2);
        }
        if (upper === 'Q') {
          [nx, ny] = [ox + rest[0], oy + rest[1]];
          [controlX, controlY] = c1;
          for (const value of quadraticExtrema(x, c1[0], nx)) points.push([value, y]);
          for (const value of quadraticExtrema(y, c1[1], ny)) points.push([x, value]);
        } else {
          const c2 = [ox + rest[0], oy + rest[1]];
          [nx, ny] = [ox + rest[2], oy + rest[3]];
          [controlX, controlY] = c2;
          for (const value of cubicExtrema(x, c1[0], c2[0], nx)) points.push([value, y]);
          for (const value of cubicExtrema(y, c1[1], c2[1], ny)) points.push([x, value]);
        }
        break;
      }
      case 'A':
        nx = ox + args[5];
        ny = oy + args[6];
        points.push(...arcPoints(x, y, args[0], args[1], args[2], args[3], args[4], nx, ny));
        break;
    }
    [x, y] = [nx, ny];
    points.push([x, y]);
    previous = upper;
    if (upper === 'Z') command = '';
  }
  return {
    minX: Math.min(...points.map(([value]) => value)),
    minY: Math.min(...points.map(([, value]) => value)),
    maxX: Math.max(...points.map(([value]) => value)),
    maxY: Math.max(...points.map(([, value]) => value)),
  };
}

const outside = [];
for (const [name, drawing] of Object.entries(iconPaths)) {
  const { minX, minY, maxX, maxY } = pathBounds(drawing);
  const overflow = Math.max(LIVE_MIN - minX, LIVE_MIN - minY, maxX - LIVE_MAX, maxY - LIVE_MAX);
  if (overflow > TOLERANCE) {
    const box = [minX, minY, maxX, maxY].map((value) => +value.toFixed(2)).join(', ');
    outside.push(`${name} [${box}] exceeds by ${overflow.toFixed(2)}`);
  }
}
assert.ok(
  outside.length === 0,
  `Drawings outside the ${LIVE_MIN}–${LIVE_MAX} live area:\n  ${outside.join('\n  ')}`,
);

console.log(
  `Folio verified: ${Object.keys(iconPaths).length} original SVG drawings inside the ${LIVE_MIN}–${LIVE_MAX} live area; ${used.size} named icons used; no active Lucide imports.`,
);
