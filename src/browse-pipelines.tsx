import { Action, ActionPanel, Detail, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { listPipelines, Pipeline } from "./lib/adoClient";

function PipelineDetail({ pipeline }: { pipeline: Pipeline }) {
  const markdown = `# ${pipeline.name}\n\n- **ID:** ${pipeline.id}\n- **Folder:** ${pipeline.folder ?? "N/A"}\n- **Revision:** ${pipeline.revision ?? "N/A"}`;
  return <Detail markdown={markdown} />;
}

export default function BrowsePipelinesCommand() {
  const { data: pipelines, isLoading, error } = useCachedPromise(listPipelines);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search pipelines...">
      {error ? <List.EmptyView title="Failed to load pipelines" description={error.message} icon={Icon.Warning} /> : null}
      {(pipelines ?? []).map((pipeline) => (
        <List.Item
          key={pipeline.id}
          title={pipeline.name}
          subtitle={`ID: ${pipeline.id}`}
          accessories={[{ text: pipeline.folder ?? "Root" }]}
          actions={
            <ActionPanel>
              <Action.Push title="View Details" target={<PipelineDetail pipeline={pipeline} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
