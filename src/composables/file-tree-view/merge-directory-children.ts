import { findNode, type TreeNode } from './path-helpers'

export type DirectoryEntry = {
  name: string
  path: string
  kind: string
}

export type WorkspaceTreeChanged = {
  rootPath: string
  directories: string[]
  rescan: boolean
}

export type FileTreeUiState = {
  expandedPaths: Set<string>
  selectedPath: string
  renamingPath: string | null
  deleteTarget: { path: string; isDirectory: boolean } | null
}

export const isRootDirectoryPath = (path: string): boolean => path === '.' || path === ''

export const isDirectoryLoaded = (tree: TreeNode | null, directoryPath: string): boolean => {
  if (!tree) {
    return false
  }
  if (isRootDirectoryPath(directoryPath)) {
    return true
  }
  const node = findNode(tree.children, directoryPath)
  return Boolean(node && node.kind === 'directory' && node.children !== undefined)
}

const compareNameCaseInsensitive = (left: string, right: string): number => {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}

const directoryNode = (tree: TreeNode, directoryPath: string): TreeNode | null => {
  if (isRootDirectoryPath(directoryPath)) {
    return tree.kind === 'directory' ? tree : null
  }
  const node = findNode(tree.children, directoryPath)
  if (!node || node.kind !== 'directory') {
    return null
  }
  return node
}

export const mergeDirectoryChildren = (
  tree: TreeNode,
  directoryPath: string,
  entries: DirectoryEntry[],
): void => {
  const node = directoryNode(tree, directoryPath)
  if (!node) {
    return
  }

  const previous = node.children ?? []
  const previousByPath = new Map(previous.map((child) => [child.path, child]))
  const merged: TreeNode[] = entries.map((entry) => {
    const existing = previousByPath.get(entry.path)
    if (!existing) {
      return {
        name: entry.name,
        path: entry.path,
        kind: entry.kind,
      }
    }
    existing.name = entry.name
    if (entry.kind === 'directory' && existing.kind === 'directory') {
      return existing
    }
    existing.kind = entry.kind
    existing.children = undefined
    return existing
  })

  merged.sort((left, right) => compareNameCaseInsensitive(left.name, right.name))
  node.children = merged
}

export const pruneMissingTreeState = (tree: TreeNode, state: FileTreeUiState): FileTreeUiState => {
  const nextExpanded = new Set<string>()
  for (const path of state.expandedPaths) {
    if (isRootDirectoryPath(path)) {
      nextExpanded.add('.')
      continue
    }
    const node = findNode(tree.children, path)
    if (node && node.kind === 'directory') {
      nextExpanded.add(path)
    }
  }
  if (!nextExpanded.has('.')) {
    nextExpanded.add('.')
  }

  const pathExists = (path: string | null | undefined): boolean => {
    if (!path) {
      return false
    }
    if (isRootDirectoryPath(path)) {
      return true
    }
    return findNode(tree.children, path) !== null
  }

  return {
    expandedPaths: nextExpanded,
    selectedPath: pathExists(state.selectedPath) ? state.selectedPath : '',
    renamingPath: pathExists(state.renamingPath) ? state.renamingPath : null,
    deleteTarget: pathExists(state.deleteTarget?.path) ? state.deleteTarget : null,
  }
}

const collectLoadedDirectoryPaths = (tree: TreeNode): string[] => {
  const paths: string[] = ['.']
  const visit = (nodes: TreeNode[] | undefined): void => {
    if (!nodes) {
      return
    }
    for (const node of nodes) {
      if (node.kind !== 'directory' || node.children === undefined) {
        continue
      }
      paths.push(node.path)
      visit(node.children)
    }
  }
  visit(tree.children)
  return paths
}

export const directoriesToRelist = (
  tree: TreeNode,
  payload: Pick<WorkspaceTreeChanged, 'directories' | 'rescan'>,
  _expandedPaths: Set<string>,
): string[] => {
  if (payload.rescan) {
    return collectLoadedDirectoryPaths(tree)
  }

  return payload.directories.filter((directoryPath) => isDirectoryLoaded(tree, directoryPath))
}

export const loadedExpandedDirectories = (tree: TreeNode, expandedPaths: Set<string>): string[] => {
  const paths = new Set<string>(['.'])
  for (const path of expandedPaths) {
    if (isRootDirectoryPath(path)) {
      continue
    }
    if (isDirectoryLoaded(tree, path)) {
      paths.add(path)
    }
  }
  return [...paths]
}
