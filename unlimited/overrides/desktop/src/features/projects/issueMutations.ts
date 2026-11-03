import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orgApi } from "@/features/unlimited/org/api";
import { relayClient } from "@/shared/api/relayClient";
import { signRelayEvent } from "@/shared/api/tauri";
import { KIND_GIT_ISSUE, KIND_TEXT_NOTE } from "@/shared/constants/kinds";
import type { Repository as Project } from "./hooks";
import { buildGitIssueTags, ISSUE_ASSIGNMENT_LABEL } from "./projectIssues.mjs";
import type { ProjectTaskCategory } from "./projectTaskCategories";

type CreateProjectIssueInput = {
  title: string;
  body: string;
  category?: ProjectTaskCategory;
  /** Unlimited Agent: "Create & start" hands the task to the developer at once (Task Desk starts the cycle). */
  start?: boolean;
};

/** The employee who receives started tasks: the project's developer (Task Desk's "Developer"). */
async function developerPubkey(): Promise<{ pubkey: string; name: string } | null> {
  try {
    const org = await orgApi.org();
    const dev = org.members.find((m) => m.id === "ai:developer" && m.pubkey);
    return dev?.pubkey ? { pubkey: dev.pubkey, name: dev.name } : null;
  } catch {
    return null;
  }
}

export async function publishProjectIssue(project: Project, input: CreateProjectIssueInput) {
  const event = await signRelayEvent({
    kind: KIND_GIT_ISSUE,
    content: input.body.trim(),
    tags: buildGitIssueTags({
      repoAddress: project.repoAddress,
      repoOwner: project.owner,
      title: input.title,
      labels: [input.category ?? "issue"],
    }),
  });
  await relayClient.publishEvent(event, "Timed out creating task.", "Failed to create task.");
  if (input.start) {
    const dev = await developerPubkey();
    if (!dev) throw new Error("The task was created, but no developer was found to start it. Assign it from the task.");
    const note = await signRelayEvent({
      kind: KIND_TEXT_NOTE,
      content: `Assigned this task to ${dev.name}`,
      createdAt: Math.max(Math.floor(Date.now() / 1_000), event.created_at + 1),
      tags: [
        ["e", event.id, "", "root"],
        ["a", project.repoAddress],
        ["p", dev.pubkey.toLowerCase()],
        ["t", ISSUE_ASSIGNMENT_LABEL],
      ],
    });
    await relayClient.publishEvent(note, "Timed out starting the task.", "The task was created but could not be started.");
  }
  return event.id;
}

export function useCreateProjectIssueMutation(project: Project | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectIssueInput) => {
      if (!project) throw new Error("No project selected.");
      return publishProjectIssue(project, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", project?.id ?? "none", "issues"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", "work-items"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", "activity-summaries"] }),
      ]);
    },
  });
}
