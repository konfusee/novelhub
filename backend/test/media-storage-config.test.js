import path from 'node:path'
import os from 'node:os'
import { expect, it } from 'vitest'
import { testEnv } from './config.js'
import { loadEnv, toAppConfig } from '../src/config/env.js'
import { mediaRoot } from '../src/modules/author-media.js'
it('retains the existing default when storage is unset or empty', () => {
  const unset = toAppConfig(loadEnv(testEnv))
  const empty = toAppConfig(loadEnv({ ...testEnv, MEDIA_STORAGE_DIR: '' }))
  expect(unset.mediaStorageDir).toBeUndefined()
  expect(mediaRoot(empty)).toBe(mediaRoot(unset))
  expect(mediaRoot(unset)).toBe(path.resolve('uploads/media'))
})
it('maps an absolute persistent directory to the media adapter without depending on the working directory', () => {
  const directory = path.join(os.tmpdir(), 'novelhub-persistent-storage')
  const config = toAppConfig(loadEnv({ ...testEnv, MEDIA_STORAGE_DIR: `  ${directory}  ` }))
  expect(config.mediaStorageDir).toBe(directory)
  expect(mediaRoot(config)).toBe(directory)
})
it('fails at startup for relative or control-character storage locations', () => {
  for (const directory of [
    'uploads/media',
    '../media',
    'C:media',
    `${path.join(os.tmpdir(), 'media')}\u0000bad`,
  ])
    expect(() => loadEnv({ ...testEnv, MEDIA_STORAGE_DIR: directory })).toThrow(/MEDIA_STORAGE_DIR/)
})
