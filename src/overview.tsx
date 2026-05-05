import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import { listDefinitions, listRunsForProject, PipelineRun } from "./lib/adoClient";
import { getProjects, ProjectEntry } from "./lib/config";

type OverviewRun = {
  project: ProjectEntry;
  definitionName: string;
  run: PipelineRun;
};

type OverviewData = {
  active: OverviewRun[];
  completedLastHour: OverviewRun[];
};

const ACTIVE_STATES = new Set(["inprogress", "notstarted", "postponed", "cancelling"]);

function formatDateTime(value?: string): string {
  return value ? new Date(value).toLocaleString() : "N/A";
}

function normalizeState(value?: string): string {
  return (value ?? "unknown").toLowerCase();
}

async function loadOverview(): Promise<OverviewData> {
  const projects = await getProjects();
  const nowMinusHour = Date.now() - 60 * 60 * 1000;
  const active: OverviewRun[] = [];
  const completedLastHour: OverviewRun[] = [];

  await Promise.all(
    projects.map(async (project) => {
      const [definitions, runs] = await Promise.all([listDefinitions(project.id), listRunsForProject(project.id)]);
      const definitionMap = new Map<number, string>(definitions.map((definition) => [definition.id, definition.name]));

      for (const run of runs) {
        const definitionName = run.definition?.name ?? definitionMap.get(run.definition?.id ?? -1) ?? run.name ?? "Unknown Definition";
        const item: OverviewRun = { project, definitionName, run };
        const state = normalizeState(run.state);

        if (ACTIVE_STATES.has(state)) {
          active.push(item);
          continue;
        }

        if (state === "completed" && run.finishedDate) {
          const finished = Date.parse(run.finishedDate);
          if (!Number.isNaN(finished) && finished >= nowMinusHour) {
            completedLastHour.push(item);
          }
        }
      }
    }),
  );

  active.sort((a, b) => Date.parse(b.run.queueTime ?? b.run.startTime ?? "") - Date.parse(a.run.queueTime ?? a.run.startTime ?? ""));
  completedLastHour.sort((a, b) => Date.parse(b.run.finishedDate ?? "") - Date.parse(a.run.finishedDate ?? ""));

  return { active, completedLastHour };
}

function AutoRefreshActions({
  intervalMs,
  setIntervalMs,
}: {
  intervalMs: number | null;
  setIntervalMs: (value: number | null) => void;
}) {
  return (
    <ActionPanel.Section title="Auto Refresh">
      <Action title="Off" onAction={() => setIntervalMs(null)} icon={intervalMs === null ? Icon.Checkmark : Icon.Circle} />
      <Action title="Every 15s" onAction={() => setIntervalMs(15000)} icon={intervalMs === 15000 ? Icon.Checkmark : Icon.Circle} />
      <Action title="Every 30s" onAction={() => setIntervalMs(30000)} icon={intervalMs === 30000 ? Icon.Checkmark : Icon.Circle} />
      <Action title="Every 60s" onAction={() => setIntervalMs(60000)} icon={intervalMs === 60000 ? Icon.Checkmark : Icon.Circle} />
    </ActionPanel.Section>
  );
}

export default function OverviewCommand() {
  const [intervalMs, setIntervalMs] = useState<number | null>(null);
  const { data, isLoading, error, revalidate } = useCachedPromise(loadOverview, []);

  useEffect(() => {
    if (!intervalMs) return;
    const timer = setInterval(() => void revalidate(), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, revalidate]);

  const intervalLabel = useMemo(() => {
    if (!intervalMs) return "Off";
    return `${intervalMs / 1000}s`;
  }, [intervalMs]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search runs across projects...">
      {error ? <List.EmptyView title="Failed to load overview" description={error.message} icon={Icon.Warning} /> : null}

      <List.Section title="Active Runs" subtitle={String(data?.active.length ?? 0)}>
        {(data?.active ?? []).map((item) => (
          <List.Item
            key={`${item.project.id}-active-${item.run.id}`}
            title={item.definitionName}
            subtitle={`${item.project.displayName} · #${item.run.buildNumber ?? item.run.id}`}
            accessories={[
              { tag: { value: item.run.state ?? "unknown", color: Color.Yellow } },
              { tag: item.run.result ?? "n/a" },
              { text: `Queued: ${formatDateTime(item.run.queueTime)}` },
              { text: `Start: ${formatDateTime(item.run.startTime)}` },
            ]}
            actions={
              <ActionPanel>
                <Action title="Refresh" onAction={() => revalidate()} icon={Icon.ArrowClockwise} />
                <AutoRefreshActions intervalMs={intervalMs} setIntervalMs={setIntervalMs} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title="Completed in Last 1 Hour" subtitle={String(data?.completedLastHour.length ?? 0)}>
        {(data?.completedLastHour ?? []).map((item) => (
          <List.Item
            key={`${item.project.id}-done-${item.run.id}`}
            title={item.definitionName}
            subtitle={`${item.project.displayName} · #${item.run.buildNumber ?? item.run.id}`}
            accessories={[
              { tag: { value: item.run.state ?? "unknown", color: Color.Green } },
              { tag: item.run.result ?? "n/a" },
              { text: `Queued: ${formatDateTime(item.run.queueTime)}` },
              { text: `Start: ${formatDateTime(item.run.startTime)}` },
              { text: `Finish: ${formatDateTime(item.run.finishedDate)}` },
            ]}
            actions={
              <ActionPanel>
                <Action title="Refresh" onAction={() => revalidate()} icon={Icon.ArrowClockwise} />
                <AutoRefreshActions intervalMs={intervalMs} setIntervalMs={setIntervalMs} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      {!isLoading && !error && (data?.active.length ?? 0) === 0 && (data?.completedLastHour.length ?? 0) === 0 ? (
        <List.EmptyView title="No matching runs" description="No active runs and no completed runs in the last hour." />
      ) : null}
      <List.Section title="Overview Controls" subtitle={`Auto refresh: ${intervalLabel}`}>
        <List.Item
          title="Refresh Overview"
          icon={Icon.ArrowClockwise}
          actions={
            <ActionPanel>
              <Action title="Refresh" onAction={() => revalidate()} icon={Icon.ArrowClockwise} />
              <AutoRefreshActions intervalMs={intervalMs} setIntervalMs={setIntervalMs} />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
