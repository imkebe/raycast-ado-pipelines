import { getPreferenceValues, LocalStorage } from "@raycast/api";

export type ExtensionPreferences = {
  adoOrganization: string;
  adoProject: string;
  personalAccessToken: string;
};

const STORAGE_KEYS = {
  lastPipelineId: "lastPipelineId",
};

export function getSettings(): ExtensionPreferences {
  return getPreferenceValues<ExtensionPreferences>();
}

export async function getLastPipelineId(): Promise<number | undefined> {
  const value = await LocalStorage.getItem<string>(STORAGE_KEYS.lastPipelineId);
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function setLastPipelineId(id: number): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEYS.lastPipelineId, String(id));
}
