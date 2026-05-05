import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { PipelineDefinition, queuePipelineRun } from "./lib/adoClient";
import { ProjectEntry } from "./lib/config";
import { RunStepsList } from "./components";

type FormValues = {
  branch: string;
  variables: string;
  templateParameters: string;
};

function parseKeyValueJson(input: string, label: string): Record<string, string> | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
  );
}

export function QueueRunForm({ definition, project }: { definition: PipelineDefinition; project: ProjectEntry }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { push, pop } = useNavigation();

  async function onSubmit(values: FormValues) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Queueing ${definition.name}...` });
    setIsSubmitting(true);

    try {
      const run = await queuePipelineRun(definition.id, {
        projectId: project.id,
        branch: values.branch,
        variables: parseKeyValueJson(values.variables, "Variables"),
        templateParameters: parseKeyValueJson(values.templateParameters, "Template parameters"),
      });

      toast.style = Toast.Style.Success;
      toast.title = `Queued run #${run.id}`;
      pop();
      push(<RunStepsList run={run} project={project} />);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to queue run";
      toast.message = error instanceof Error ? error.message : "Unknown error";
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Queue Run" onSubmit={onSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Pipeline" text={`${definition.name} (ID: ${definition.id})`} />
      <Form.TextField id="branch" title="Branch / Ref" placeholder="refs/heads/main (optional)" />
      <Form.TextArea id="variables" title="Variables JSON" placeholder='{"env":"prod"}' />
      <Form.TextArea id="templateParameters" title="Template Parameters JSON" placeholder='{"deployRegion":"us"}' />
    </Form>
  );
}
