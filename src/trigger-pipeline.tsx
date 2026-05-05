import { Action, ActionPanel, Form, showToast, Toast } from "@raycast/api";
import { listPipelines, triggerPipeline } from "./lib/adoClient";
import { getLastPipelineId, setLastPipelineId } from "./lib/settings";
import { useEffect, useState } from "react";

type FormValues = {
  pipelineId: string;
};

export default function TriggerPipelineCommand() {
  const [pipelines, setPipelines] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultPipelineId, setDefaultPipelineId] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const [pipelineList, lastPipelineId] = await Promise.all([listPipelines(), getLastPipelineId()]);
        setPipelines(pipelineList.map((pipeline) => ({ id: pipeline.id, name: pipeline.name })));
        if (lastPipelineId) {
          setDefaultPipelineId(String(lastPipelineId));
        }
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  async function handleSubmit(values: FormValues) {
    const pipelineId = Number(values.pipelineId);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Triggering pipeline..." });

    try {
      const run = await triggerPipeline(pipelineId);
      await setLastPipelineId(pipelineId);
      toast.style = Toast.Style.Success;
      toast.title = `Pipeline queued (#${run.id})`;
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to trigger pipeline";
      toast.message = error instanceof Error ? error.message : "Unknown error";
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Trigger Pipeline" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="pipelineId" title="Pipeline" defaultValue={defaultPipelineId}>
        {pipelines.map((pipeline) => (
          <Form.Dropdown.Item key={pipeline.id} value={String(pipeline.id)} title={pipeline.name} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
