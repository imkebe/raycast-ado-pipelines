import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getProjects, ProjectEntry } from "./lib/config";
import { listDefinitions, listRunsForDefinition, PipelineDefinition, PipelineRun } from "./lib/adoClient";
import { RunStepsList } from "./components";
import { QueueRunForm } from "./queue-run-form";

function formatDateTime(date?: string): string {
  return date ? new Date(date).toLocaleString() : "N/A";
}

function projectSubtitle(project: ProjectEntry): string {
  return `${project.org}/${project.project}`;
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
              <Action.Push title="View Steps" target={<RunStepsList run={run} project={project} />} />
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
              <Action.Push title="Queue Run" target={<QueueRunForm definition={definition} project={project} />} icon={Icon.Play} />
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
