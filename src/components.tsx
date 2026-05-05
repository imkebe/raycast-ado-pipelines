import { Action, ActionPanel, Detail, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { ProjectEntry } from "./lib/config";
import { getRunTimelineRecords, getStepDetail, PipelineRun, PipelineTimelineRecord } from "./lib/adoClient";

function formatDateTime(date?: string): string {
  return date ? new Date(date).toLocaleString() : "N/A";
}

function StepDetailView({ runId, project, step }: { runId: number; project: ProjectEntry; step: PipelineTimelineRecord }) {
  const { data, isLoading, error } = useCachedPromise(
    (targetRunId: number, record: PipelineTimelineRecord, projectId: string) => getStepDetail(targetRunId, record, projectId),
    [runId, step, project.id],
  );

  if (error) {
    return <Detail markdown={`# Failed to load step detail\n\n${error.message}`} />;
  }

  const record = data?.record ?? step;
  const issues = record.issues?.length
    ? record.issues.map((issue) => `- **${issue.type ?? "Issue"}:** ${issue.message ?? "No message"}`).join("\n")
    : "- None";
  const markdown = `# ${record.name}

## Metadata
- **Type:** ${record.type ?? "N/A"}
- **State:** ${record.state ?? "N/A"}
- **Result:** ${record.result ?? "N/A"}
- **Started:** ${formatDateTime(record.startTime)}
- **Finished:** ${formatDateTime(record.finishTime)}
- **Worker:** ${record.workerName ?? "N/A"}

## Issues
${issues}

## Log
\`\`\`
${data?.logContent?.slice(0, 12000) ?? "No log available for this step."}
\`\`\``;

  return <Detail isLoading={isLoading} markdown={markdown} />;
}

export function RunStepsList({ run, project }: { run: PipelineRun; project: ProjectEntry }) {
  const { data, isLoading, error } = useCachedPromise(getRunTimelineRecords, [run.id, project.id]);
  const steps = data ?? [];

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search steps...">
      {error ? <List.EmptyView title="Failed to load steps" description={error.message} icon={Icon.Warning} /> : null}
      {!error && !isLoading && !steps.length ? <List.EmptyView title="No steps found" description="Timeline has no records." /> : null}
      {steps.map((step) => (
        <List.Item
          key={step.id}
          title={step.name}
          subtitle={step.type ?? "Step"}
          accessories={[{ tag: step.state ?? "Unknown" }, { tag: step.result ?? "N/A" }]}
          actions={
            <ActionPanel>
              <Action.Push title="View Step Details" target={<StepDetailView runId={run.id} project={project} step={step} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
