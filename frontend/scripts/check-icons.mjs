import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { iconPaths } from '../src/components/icons/iconPaths.js'

const root = path.resolve(import.meta.dirname, '..')
const source = path.join(root, 'src')
const exported = readFileSync(path.join(source, 'components/icons/index.jsx'), 'utf8')
const sprite = readFileSync(path.join(root, 'public/novelhub-icons.svg'), 'utf8')
const used = new Set()
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      check(file)
      continue
    }
    if (!/\.(jsx|js)$/.test(file)) continue
    const content = readFileSync(file, 'utf8')
    assert.ok(!content.includes("from 'lucide-react'"), `Unmigrated icon dependency: ${file}`)
    for (const [, names] of content.matchAll(
      /import\s*\{([^}]+)\}\s*from\s*['"][^'"]*\/icons['"]/g,
    )) {
      for (const name of names
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)) {
        assert.ok(iconPaths[name], `Missing drawing: ${name} in ${file}`)
        assert.ok(exported.includes(`export const ${name} =`), `Missing React component: ${name}`)
        used.add(name)
      }
    }
  }
}
check(source)
for (const [name, drawing] of Object.entries(iconPaths)) {
  assert.ok(
    sprite.includes(`id="${name}" viewBox="0 0 24 24"><path d="${drawing}"`),
    `Sprite differs from original drawing: ${name}`,
  )
}
for (const file of ['favicon.svg', 'novelhub-mark.svg']) {
  assert.ok(
    readFileSync(path.join(root, 'public', file), 'utf8').includes(iconPaths.NovelHubMark),
    `Brand mark mismatch: ${file}`,
  )
}
console.log(
  `Folio verified: ${Object.keys(iconPaths).length} original SVG drawings; ${used.size} named icons used; no active Lucide imports.`,
)
