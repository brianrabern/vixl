import { describe, expect, it } from 'vitest'
import type { TreeNode } from '@/composables/file-tree-view/path-helpers'
import {
  directoriesToRelist,
  isDirectoryLoaded,
  mergeDirectoryChildren,
  pruneMissingTreeState,
} from '@/composables/file-tree-view/merge-directory-children'

const file = (name: string, path: string): TreeNode => ({
  name,
  path,
  kind: 'file',
})

const dir = (name: string, path: string, children?: TreeNode[]): TreeNode => ({
  name,
  path,
  kind: 'directory',
  children,
})

const sampleTree = (): TreeNode =>
  dir('.', '.', [
    dir('src', 'src', [
      dir('lib', 'src/lib', [file('a.ts', 'src/lib/a.ts')]),
      file('index.ts', 'src/index.ts'),
    ]),
    file('README.md', 'README.md'),
  ])

describe('mergeDirectoryChildren', () => {
  it('adds a new row', () => {
    const tree = sampleTree()

    mergeDirectoryChildren(tree, '.', [
      { name: 'README.md', path: 'README.md', kind: 'file' },
      { name: 'src', path: 'src', kind: 'directory' },
      { name: 'LICENSE', path: 'LICENSE', kind: 'file' },
    ])

    expect(tree.children?.map((node) => node.path)).toEqual(['LICENSE', 'README.md', 'src'])
  })

  it('drops a missing row', () => {
    const tree = sampleTree()

    mergeDirectoryChildren(tree, '.', [{ name: 'src', path: 'src', kind: 'directory' }])

    expect(tree.children?.map((node) => node.path)).toEqual(['src'])
  })

  it('keeps loaded grandchildren on the existing subdirectory node', () => {
    const tree = sampleTree()
    const src = tree.children?.find((node) => node.path === 'src')
    const lib = src?.children?.find((node) => node.path === 'src/lib')
    expect(src?.path).toBe('src')
    expect(lib?.path).toBe('src/lib')

    mergeDirectoryChildren(tree, '.', [
      { name: 'README.md', path: 'README.md', kind: 'file' },
      { name: 'src', path: 'src', kind: 'directory' },
    ])

    const nextSrc = tree.children?.find((node) => node.path === 'src')
    expect(nextSrc).toBe(src)
    expect(nextSrc?.children?.[0]).toBe(lib)
    expect(lib?.children?.map((node) => node.path)).toEqual(['src/lib/a.ts'])
  })

  it('sorts children case-insensitively by name', () => {
    const tree = dir('.', '.', [])

    mergeDirectoryChildren(tree, '.', [
      { name: 'Zebra', path: 'Zebra', kind: 'file' },
      { name: 'apple', path: 'apple', kind: 'file' },
      { name: 'Banana', path: 'Banana', kind: 'file' },
    ])

    expect(tree.children?.map((node) => node.name)).toEqual(['apple', 'Banana', 'Zebra'])
  })
})

describe('pruneMissingTreeState', () => {
  it('drops a removed directory from expandedPaths', () => {
    const tree = sampleTree()
    mergeDirectoryChildren(tree, '.', [{ name: 'README.md', path: 'README.md', kind: 'file' }])

    const next = pruneMissingTreeState(tree, {
      expandedPaths: new Set(['.', 'src', 'src/lib']),
      selectedPath: '',
      renamingPath: 'src/index.ts',
      deleteTarget: { path: 'src', isDirectory: true },
    })

    expect([...next.expandedPaths].sort()).toEqual(['.'])
    expect(next.renamingPath).toBe(null)
    expect(next.deleteTarget).toBe(null)
  })

  it('clears selectedPath when the selected file is gone', () => {
    const tree = sampleTree()
    mergeDirectoryChildren(tree, 'src', [{ name: 'lib', path: 'src/lib', kind: 'directory' }])

    const next = pruneMissingTreeState(tree, {
      expandedPaths: new Set(['.', 'src']),
      selectedPath: 'src/index.ts',
      renamingPath: null,
      deleteTarget: null,
    })

    expect(next.selectedPath).toBe('')
    expect([...next.expandedPaths].sort()).toEqual(['.', 'src'])
  })
})

describe('isDirectoryLoaded', () => {
  it('treats the root as loaded and unloaded dirs as not loaded', () => {
    const tree = dir('.', '.', [dir('src', 'src'), dir('docs', 'docs', [])])

    expect(isDirectoryLoaded(tree, '.')).toBe(true)
    expect(isDirectoryLoaded(tree, 'src')).toBe(false)
    expect(isDirectoryLoaded(tree, 'docs')).toBe(true)
    expect(isDirectoryLoaded(null, '.')).toBe(false)
  })
})

describe('directoriesToRelist', () => {
  it('skips unloaded directories on a normal event', () => {
    const tree = dir('.', '.', [dir('src', 'src'), dir('docs', 'docs', [])])

    expect(
      directoriesToRelist(
        tree,
        { directories: ['.', 'src', 'docs'], rescan: false },
        new Set(['.', 'src', 'docs']),
      ),
    ).toEqual(['.', 'docs'])
  })

  it('relists the root and every loaded directory on rescan', () => {
    const tree = dir('.', '.', [dir('src', 'src'), dir('docs', 'docs', [])])

    expect(
      directoriesToRelist(
        tree,
        { directories: [], rescan: true },
        new Set(['.', 'src', 'docs', 'gone']),
      ).sort(),
    ).toEqual(['.', 'docs'])
  })

  it('includes a prefetched-but-collapsed directory on rescan', () => {
    const tree = dir('.', '.', [
      dir('src', 'src', [
        dir('lib', 'src/lib', [file('a.ts', 'src/lib/a.ts')]),
        file('index.ts', 'src/index.ts'),
      ]),
      dir('docs', 'docs'),
    ])

    expect(
      directoriesToRelist(tree, { directories: [], rescan: true }, new Set(['.'])).sort(),
    ).toEqual(['.', 'src', 'src/lib'])
  })
})
