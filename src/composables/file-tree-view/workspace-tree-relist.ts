import { type ComputedRef, type Ref } from 'vue'
import { fsListDir } from '@/services/vixl/vixl-tauri'
import { parentPath, type TreeNode } from './path-helpers'
import {
  isDirectoryLoaded,
  isRootDirectoryPath,
  mergeDirectoryChildren,
  pruneMissingTreeState,
} from './merge-directory-children'

type RelistState = {
  tree: Ref<TreeNode | null>
  expandedPaths: Ref<Set<string>>
  selectedPath: Ref<string>
  renamingPath: Ref<string | null>
  deleteTarget: Ref<{ path: string; isDirectory: boolean } | null>
  projectRoot: ComputedRef<string | null>
  refreshGit: () => Promise<void>
  onTreeChanged: () => void
}

export const recoverTreeSyncError = (error: unknown): void => {
  if (error instanceof Error) {
    return
  }
}

const applyPrunedTreeState = (state: RelistState, currentTree: TreeNode): void => {
  const pruned = pruneMissingTreeState(currentTree, {
    expandedPaths: state.expandedPaths.value,
    selectedPath: state.selectedPath.value,
    renamingPath: state.renamingPath.value,
    deleteTarget: state.deleteTarget.value,
  })
  state.expandedPaths.value = pruned.expandedPaths
  state.selectedPath.value = pruned.selectedPath
  state.renamingPath.value = pruned.renamingPath
  state.deleteTarget.value = pruned.deleteTarget
}

const listAndMergeDirectory = async (
  root: string,
  currentTree: TreeNode,
  directoryPath: string,
): Promise<void> => {
  try {
    const entries = await fsListDir(root, directoryPath)
    mergeDirectoryChildren(currentTree, directoryPath, entries)
  } catch (error) {
    recoverTreeSyncError(error)
    if (isRootDirectoryPath(directoryPath)) {
      return
    }
    const parent = parentPath(directoryPath)
    if (!isDirectoryLoaded(currentTree, parent)) {
      return
    }
    try {
      const parentEntries = await fsListDir(root, parent)
      mergeDirectoryChildren(currentTree, parent, parentEntries)
    } catch (parentError) {
      recoverTreeSyncError(parentError)
    }
  }
}

export const relistDirectories = async (
  state: RelistState,
  getGeneration: () => number,
  directories: string[],
  options: { refreshGit: boolean },
): Promise<void> => {
  const root = state.projectRoot.value
  const currentTree = state.tree.value
  if (!root || !currentTree || directories.length === 0) {
    return
  }
  const generation = getGeneration()
  for (const directoryPath of directories) {
    if (generation !== getGeneration()) {
      return
    }
    await listAndMergeDirectory(root, currentTree, directoryPath)
  }
  if (generation !== getGeneration() || state.tree.value !== currentTree) {
    return
  }
  applyPrunedTreeState(state, currentTree)
  if (options.refreshGit) {
    await state.refreshGit()
  }
  state.onTreeChanged()
}
