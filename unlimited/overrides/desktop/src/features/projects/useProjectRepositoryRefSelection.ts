import * as React from "react";

/**
 * Unlimited Agent: the branch you pick for a repository is remembered (per repository, on this computer),
 * so the project opens on it next time instead of going back to the repository's default branch.
 */
const KEY = "unlimited:branch:";

function remembered(repositoryId: string | null): string | null {
  if (!repositoryId) return null;
  try {
    return window.localStorage.getItem(KEY + repositoryId);
  } catch {
    return null;
  }
}

function remember(repositoryId: string | null, branch: string | null) {
  if (!repositoryId) return;
  try {
    if (branch) window.localStorage.setItem(KEY + repositoryId, branch);
    else window.localStorage.removeItem(KEY + repositoryId);
  } catch {
    // Storage can be unavailable; the choice then lasts for this visit only.
  }
}

export function useProjectRepositoryRefSelection(input: {
  branchOptions: string[];
  defaultBranch: string | null;
  projectAvailable: boolean;
  projectPending: boolean;
  /** Identity of the repository the options describe. A switch to a different repository resets the
   * selection to that repository's remembered branch (or its default). */
  repositoryId: string | null;
  tags: Array<{ name: string }>;
}) {
  const [selectedBranch, setSelectedBranch] = React.useState<string | null>(() => remembered(input.repositoryId));
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [selectionRepositoryId, setSelectionRepositoryId] = React.useState(input.repositoryId);
  // Reset during render (not in an effect) so a repository switch never paints the previous repository's selection.
  if (selectionRepositoryId !== input.repositoryId) {
    setSelectionRepositoryId(input.repositoryId);
    setSelectedBranch(remembered(input.repositoryId));
    setSelectedTag(null);
  }
  const staleSelection = selectionRepositoryId !== input.repositoryId;
  const current = staleSelection ? remembered(input.repositoryId) : selectedBranch;
  // Until the branch list arrives, trust the remembered branch; afterwards it must still exist.
  const valid =
    current && (input.branchOptions.length === 0 || input.branchOptions.includes(current)) ? current : null;
  const activeBranch = valid ?? input.defaultBranch ?? input.branchOptions[0] ?? null;

  React.useEffect(() => {
    if (!input.projectAvailable) {
      if (input.projectPending) return;
      setSelectedTag(null);
      return;
    }
    setSelectedBranch((currentBranch) => {
      if (currentBranch && (input.branchOptions.length === 0 || input.branchOptions.includes(currentBranch))) {
        return currentBranch;
      }
      return input.defaultBranch ?? input.branchOptions[0] ?? null;
    });
    setSelectedTag((currentTag) => {
      if (currentTag && input.tags.some((tag) => tag.name === currentTag)) {
        return currentTag;
      }
      return null;
    });
  }, [input.branchOptions, input.defaultBranch, input.projectAvailable, input.projectPending, input.tags]);

  const repositoryId = input.repositoryId;
  const selectBranch = React.useCallback(
    (branch: string | null) => {
      setSelectedBranch(branch);
      setSelectedTag(null);
      remember(repositoryId, branch);
    },
    [repositoryId],
  );
  const selectTag = React.useCallback((tag: string) => {
    setSelectedTag(tag);
  }, []);

  return {
    activeBranch,
    selectBranch,
    selectedTag: staleSelection ? null : selectedTag,
    selectTag,
  };
}
