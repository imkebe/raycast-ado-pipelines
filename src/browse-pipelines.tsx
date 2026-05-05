import { Action, ActionPanel, Detail, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getProjects, ProjectEntry } from "./lib/config";
import {
  getRunTimelineRecords,
  getStepDetail,
  listDefinitions,
  listRunsForDefinition,
  PipelineDefinition,
  PipelineRun,
  PipelineTimelineRecord,
} from "./lib/adoClient";

function formatDateTime(date?: string): string {
  return date ? new Date(date).toLocaleString() : "N/A";
}

function projectSubtitle(project: ProjectEntry): string {
  return `${project.org}/${project.project}`;
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

function StepsList({ run, project }: { run: PipelineRun; project: ProjectEntry }) {
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

function RunsList({ definition, project }: { definition: PipelineDefinition; project: ProjectEntry }) {
  const { data, isLoading, error } = useCachedPromise(listRunsForDefinition, [definition.id, project.id]);
  const runs = data ?? [];

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search runs...">
      {error ? <List.EmptyView title="Failed to load runs" description={error.message} icon={Icon.Warning} /> : null}
      {!error && !isLoading && !runs.length ? (
        <List.EmptyView title="No runs found" description="Run this pipeline to see history." />
      ) : null}
      {runs.map((run) => (
        <List.Item
          key={run.id}
          title={`Run #${run.id}`}
          subtitle={run.state ?? "Unknown"}
          accessories={[{ tag: run.result ?? "N/A" }, { text: formatDateTime(run.createdDate) }]}
          actions={
            <ActionPanel>
              <Action.Push title="View Steps" target={<StepsList run={run} project={project} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function DefinitionsList({ project }: { project: ProjectEntry }) {
  const { data, isLoading, error } = useCachedPromise(listDefinitions, [project.id]);
  const definitions = data ?? [];

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search definitions...">
      {error ? <List.EmptyView title="Failed to load definitions" description={error.message} icon={Icon.Warning} /> : null}
      {!error && !isLoading && !definitions.length ? <List.EmptyView title="No definitions found" /> : null}
      {definitions.map((definition) => (
        <List.Item
          key={definition.id}
          title={definition.name}
          subtitle={`ID: ${definition.id}`}
          accessories={[{ text: definition.path ?? definition.folder ?? "Root" }]}
          actions={
            <ActionPanel>
              <Action.Push title="Browse Runs" target={<RunsList definition={definition} project={project} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

export default function BrowsePipelinesCommand() {
  const { data, isLoading, error } = useCachedPromise(getProjects);
  const projects = data ?? [];

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Pick a project...">
      {error ? <List.EmptyView title="Failed to load projects" description={error.message} icon={Icon.Warning} /> : null}
      {!error && !isLoading && !projects.length ? (
        <List.EmptyView title="No saved projects" description="Add projects first in extension settings." />
      ) : null}
      {projects.map((project) => (
        <List.Item
          key={project.id}
          title={project.displayName}
          subtitle={projectSubtitle(project)}
          accessories={project.isDefault ? [{ icon: Icon.Checkmark, tooltip: "Default project" }] : []}
          actions={
            <ActionPanel>
              <Action.Push title="Browse Definitions" target={<DefinitionsList project={project} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
