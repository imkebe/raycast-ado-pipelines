import { getActiveProjectContext, ProjectEntry } from "./config";

export type PipelineDefinition = {
  id: number;
  name: string;
  folder?: string;
  revision?: number;
  path?: string;
  queueStatus?: string;
};

export type PipelineRun = {
  id: number;
  name?: string;
  state?: string;
  result?: string;
  createdDate?: string;
  finishedDate?: string;
  url?: string;
};

export type PipelineTimelineRecord = {
  id: string;
  parentId?: string;
  type?: string;
  name: string;
  order?: number;
  state?: string;
  result?: string;
  startTime?: string;
  finishTime?: string;
  workerName?: string;
  issues?: { type?: string; message?: string }[];
  log?: { id?: number; url?: string };
};

export type PipelineStepDetail = {
  record: PipelineTimelineRecord;
  logContent?: string;
};

type DefinitionsResponse = { value: PipelineDefinition[] };
type RunsResponse = { value: PipelineRun[] };
type TimelineResponse = { records: PipelineTimelineRecord[] };

function createAuthHeader(token: string): string {
  const encoded = Buffer.from(`:${token}`).toString("base64");
  return `Basic ${encoded}`;
}

function projectApiBase(project: ProjectEntry): string {
  return `https://dev.azure.com/${project.org}/${project.project}/_apis`;
}

async function resolveContext(projectId?: string): Promise<{ authHeader: string; project: ProjectEntry }> {
  const { pat, project, projects } = await getActiveProjectContext();
  const selected = projectId ? projects.find((candidate) => candidate.id === projectId) ?? null : project;

  if (!pat) {
    throw new Error("No Personal Access Token configured");
  }
  if (!selected) {
    throw new Error("No saved project available");
  }

  return { authHeader: createAuthHeader(pat), project: selected };
}

async function fetchJson<T>(url: string, authHeader: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Azure DevOps request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function listDefinitions(projectId?: string): Promise<PipelineDefinition[]> {
  const { authHeader, project } = await resolveContext(projectId);
  const url = `${projectApiBase(project)}/build/definitions?api-version=7.1`;
  const json = await fetchJson<DefinitionsResponse>(url, authHeader);
  return json.value ?? [];
}

export async function listRunsForDefinition(definitionId: number, projectId?: string): Promise<PipelineRun[]> {
  const { authHeader, project } = await resolveContext(projectId);
  const url = `${projectApiBase(project)}/build/builds?definitions=${definitionId}&queryOrder=queueTimeDescending&$top=50&api-version=7.1`;
  const json = await fetchJson<RunsResponse>(url, authHeader);
  return json.value ?? [];
}

export async function getRunTimelineRecords(runId: number, projectId?: string): Promise<PipelineTimelineRecord[]> {
  const { authHeader, project } = await resolveContext(projectId);
  const url = `${projectApiBase(project)}/build/builds/${runId}/timeline?api-version=7.1`;
  const json = await fetchJson<TimelineResponse>(url, authHeader);
  return (json.records ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getStepDetail(runId: number, record: PipelineTimelineRecord, projectId?: string): Promise<PipelineStepDetail> {
  if (!record.log?.id) {
    return { record };
  }

  const { authHeader, project } = await resolveContext(projectId);
  const url = `${projectApiBase(project)}/build/builds/${runId}/logs/${record.log.id}?api-version=7.1`;
  const response = await fetch(url, { headers: { Authorization: authHeader } });

  if (!response.ok) {
    throw new Error(`Failed to fetch step log (${response.status})`);
  }

  return {
    record,
    logContent: await response.text(),
  };
}

export async function triggerPipeline(pipelineId: number): Promise<PipelineRun> {
  const { authHeader, project } = await resolveContext();
  const url = `${projectApiBase(project)}/pipelines/${pipelineId}/runs?api-version=7.1-preview.1`;
  return fetchJson<PipelineRun>(url, authHeader, {
    method: "POST",
    body: JSON.stringify({ resources: {} }),
  });
}

export async function listPipelines(): Promise<PipelineDefinition[]> {
  return listDefinitions();
}
