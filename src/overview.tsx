import { Action, ActionPanel, Detail } from "@raycast/api";
import { getSettings } from "./lib/settings";

export default function OverviewCommand() {
  const settings = getSettings();
  const markdown = `# ADO Pipelines Overview

## Active Configuration
- **Organization:** ${settings.adoOrganization}
- **Project:** ${settings.adoProject}
- **PAT Configured:** ${settings.personalAccessToken ? "Yes" : "No"}

Use **Browse Pipelines** to inspect definitions and **Trigger Pipeline** to queue a run.`;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Organization" content={settings.adoOrganization} />
          <Action.CopyToClipboard title="Copy Project" content={settings.adoProject} />
        </ActionPanel>
      }
    />
  );
}
