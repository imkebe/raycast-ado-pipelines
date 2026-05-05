import { LocalStorage } from "@raycast/api";

const STORAGE_KEYS = {
  pat: "ado.pat",
  projects: "ado.projects",
  defaultProjectId: "ado.defaultProjectId",
} as const;

export type ProjectIdentifier = {
  org: string;
  project: string;
};

export type ProjectEntry = {
  id: string;
  displayName: string;
  org: string;
  project: string;
  isDefault?: boolean;
};

export type ActiveProjectContext = {
  pat: string | null;
  project: ProjectEntry | null;
  projects: ProjectEntry[];
};

type StoredProject = Omit<ProjectEntry, "isDefault">;

function safeParseProjects(value: string | undefined | null): StoredProject[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is StoredProject => {
        return (
          item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.displayName === "string" &&
          typeof item.org === "string" &&
          typeof item.project === "string"
        );
      })
      .map((item) => ({
        id: item.id,
        displayName: item.displayName.trim(),
        org: normalizeOrganization(item.org),
        project: item.project.trim(),
      }))
      .filter((item) => item.displayName && item.org && item.project);
  } catch {
    return [];
  }
}

function generateProjectId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOrganization(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeProjectInput(input: { displayName: string; org: string; project: string }): Omit<ProjectEntry, "id" | "isDefault"> {
  return {
    displayName: input.displayName.trim(),
    org: normalizeOrganization(input.org),
    project: input.project.trim(),
  };
}

async function readProjects(): Promise<StoredProject[]> {
  return safeParseProjects(await LocalStorage.getItem<string>(STORAGE_KEYS.projects));
}

async function writeProjects(projects: StoredProject[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
}

export async function getProjects(): Promise<ProjectEntry[]> {
  const [projects, defaultProjectId] = await Promise.all([
    readProjects(),
    LocalStorage.getItem<string>(STORAGE_KEYS.defaultProjectId),
  ]);

  return projects.map((project) => ({
    ...project,
    isDefault: project.id === defaultProjectId,
  }));
}

export async function saveProject(project: Partial<ProjectEntry> & ProjectIdentifier & { displayName: string }): Promise<ProjectEntry> {
  const normalized = normalizeProjectInput(project);
  if (!normalized.displayName || !normalized.org || !normalized.project) {
    throw new Error("displayName, org, and project are required");
  }

  const projects = await readProjects();

  const id = project.id?.trim() || generateProjectId();
  const nextProject: StoredProject = { id, ...normalized };
  const existingIdx = projects.findIndex((candidate) => candidate.id === id);
  const nextProjects = [...projects];

  if (existingIdx >= 0) {
    nextProjects[existingIdx] = nextProject;
  } else {
    nextProjects.push(nextProject);
  }

  await writeProjects(nextProjects);

  if (project.isDefault || nextProjects.length === 1) {
    await setDefaultProject(id);
  }

  const defaultProjectId = await LocalStorage.getItem<string>(STORAGE_KEYS.defaultProjectId);
  return { ...nextProject, isDefault: defaultProjectId === id };
}

export async function removeProject(projectId: string): Promise<void> {
  const normalizedId = projectId.trim();
  if (!normalizedId) return;

  const [projects, defaultProjectId] = await Promise.all([
    readProjects(),
    LocalStorage.getItem<string>(STORAGE_KEYS.defaultProjectId),
  ]);

  const remaining = projects.filter((project) => project.id !== normalizedId);
  await writeProjects(remaining);

  if (defaultProjectId === normalizedId) {
    const nextDefault = remaining[0]?.id;
    if (nextDefault) {
      await LocalStorage.setItem(STORAGE_KEYS.defaultProjectId, nextDefault);
    } else {
      await LocalStorage.removeItem(STORAGE_KEYS.defaultProjectId);
    }
  }
}

export async function setDefaultProject(projectId: string): Promise<void> {
  const normalizedId = projectId.trim();
  if (!normalizedId) {
    await LocalStorage.removeItem(STORAGE_KEYS.defaultProjectId);
    return;
  }

  const projects = await readProjects();
  const exists = projects.some((project) => project.id === normalizedId);
  if (!exists) {
    throw new Error(`Project ${normalizedId} does not exist`);
  }

  await LocalStorage.setItem(STORAGE_KEYS.defaultProjectId, normalizedId);
}

/**
 * PAT (Personal Access Token) handling.
 *
 * Raycast LocalStorage data is persisted locally per extension. This function pair
 * centralizes PAT reads/writes so calling code can treat token handling as a single API.
 */
export async function getPAT(): Promise<string | null> {
  const value = await LocalStorage.getItem<string>(STORAGE_KEYS.pat);
  return value?.trim() || null;
}

export async function setPAT(token: string): Promise<void> {
  const normalized = token.trim();
  if (!normalized) {
    await LocalStorage.removeItem(STORAGE_KEYS.pat);
    return;
  }

  await LocalStorage.setItem(STORAGE_KEYS.pat, normalized);
}

export async function clearPAT(): Promise<void> {
  await LocalStorage.removeItem(STORAGE_KEYS.pat);
}

export async function getActiveProjectContext(): Promise<ActiveProjectContext> {
  const [projects, pat, defaultProjectId] = await Promise.all([
    readProjects(),
    getPAT(),
    LocalStorage.getItem<string>(STORAGE_KEYS.defaultProjectId),
  ]);

  const active =
    projects.find((project) => project.id === defaultProjectId) ??
    projects[0] ??
    null;

  return {
    pat,
    project: active ? { ...active, isDefault: active.id === defaultProjectId } : null,
    projects: projects.map((project) => ({ ...project, isDefault: project.id === defaultProjectId })),
  };
}
