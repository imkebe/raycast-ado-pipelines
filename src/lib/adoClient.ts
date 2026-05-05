import { getSettings } from "./settings";

export type Pipeline = {
  id: number;
  name: string;
  folder?: string;
  revision?: number;
};

export type PipelineRunResult = {
  id: number;
  state?: string;
  result?: string;
  url?: string;
};

type PipelinesResponse = {
  value: Pipeline[];
};

function createAuthHeader(token: string): string {
  const encoded = Buffer.from(`:${token}`).toString("base64");
  return `Basic ${encoded}`;
}

function baseUrl(): string {
  const { adoOrganization, adoProject } = getSettings();
  return `https://dev.azure.com/${adoOrganization}/${adoProject}/_apis`;
}

export async function listPipelines(): Promise<Pipeline[]> {
  const { personalAccessToken } = getSettings();
  const response = await fetch(`${baseUrl()}/pipelines?api-version=7.1-preview.1`, {
    headers: {
      Authorization: createAuthHeader(personalAccessToken),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pipelines (${response.status})`);
  }

  const json = (await response.json()) as PipelinesResponse;
  return json.value;
}

export async function triggerPipeline(pipelineId: number): Promise<PipelineRunResult> {
  const { personalAccessToken } = getSettings();
  const response = await fetch(`${baseUrl()}/pipelines/${pipelineId}/runs?api-version=7.1-preview.1`, {
    method: "POST",
    headers: {
      Authorization: createAuthHeader(personalAccessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resources: {} }),
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger pipeline (${response.status})`);
  }

  return (await response.json()) as PipelineRunResult;
}
