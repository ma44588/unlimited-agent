#!/usr/bin/env python3
"""Apply Unlimited Agent branding to a Buzz checkout at build time.

Branding is applied in CI just before the desktop build, so the upstream
source stays untouched and block/buzz updates keep merging cleanly.

  python3 unlimited/brand.py          # apply
  python3 unlimited/brand.py --check  # report what would change
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESKTOP = ROOT / "desktop"
NAME = "Unlimited Agent"
IDENTIFIER = "technology.unlimitedsolutions.agent"
WORD = re.compile(r"\bBuzz\b")
# Lines that carry code identity rather than user-facing copy.
SKIP_LINE = re.compile(r"import |require\(|://|xyz\.block|@buzz|buzz-|BUZZ_|data-testid", re.I)
SKIP_PATH = re.compile(r"(\.test\.|\.spec\.|/testing/|/__tests__/|/fixtures?/|\.d\.ts$)")


def brand_tauri_conf(check: bool) -> int:
    path = DESKTOP / "src-tauri" / "tauri.conf.json"
    conf = json.loads(path.read_text())
    conf["productName"] = NAME
    conf["identifier"] = IDENTIFIER
    # Ad-hoc signature: unsigned apps show as "damaged" on Apple Silicon.
    conf.setdefault("bundle", {}).setdefault("macOS", {})["signingIdentity"] = "-"
    for win in conf.get("app", {}).get("windows", []):
        if win.get("title") == "Buzz":
            win["title"] = NAME
    if not check:
        path.write_text(json.dumps(conf, indent=2, ensure_ascii=False) + "\n")
    return 1


def brand_ui_strings(check: bool) -> int:
    changed = 0
    files = [p for ext in ("*.ts", "*.tsx") for p in (DESKTOP / "src").rglob(ext)]
    files.append(DESKTOP / "index.html")
    for path in files:
        if not path.exists() or SKIP_PATH.search(str(path)):
            continue
        text = path.read_text()
        out, n = [], 0
        for line in text.splitlines(keepends=True):
            if WORD.search(line) and not SKIP_LINE.search(line):
                line, k = WORD.subn(NAME, line)
                n += k
            out.append(line)
        if n:
            changed += n
            if not check:
                path.write_text("".join(out))
    return changed


def brand_installer(check: bool) -> None:
    """Replace the macOS DMG window background with the Unlimited one."""
    src = ROOT / "unlimited" / "brand" / "dmg-background.png"
    dst = DESKTOP / "src-tauri" / "icons" / "dmg-background.png"
    if src.exists() and not check:
        dst.write_bytes(src.read_bytes())


def brand_overrides(check: bool) -> int:
    """Copy unlimited/overrides/** over the checkout (logo, wordmark, no bees)."""
    base = ROOT / "unlimited" / "overrides"
    n = 0
    for src in base.rglob("*"):
        if src.is_file():
            dst = ROOT / src.relative_to(base)
            n += 1
            if not check:
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(src.read_bytes())
    plist = DESKTOP / "src-tauri" / "Info.plist"
    if plist.exists() and not check:
        plist.write_text(plist.read_text().replace("<string>Buzz</string>", f"<string>{NAME}</string>"))
    return n


def brand_theme(check: bool) -> None:
    """Append the Unlimited colour theme (unlayered, so it wins over upstream tokens)."""
    src = ROOT / "unlimited" / "brand" / "theme.css"
    dst = DESKTOP / "src" / "shared" / "styles" / "globals" / "theme.css"
    marker = "Unlimited Solutions brand theme"
    if src.exists() and dst.exists() and not check and marker not in dst.read_text():
        dst.write_text(dst.read_text() + "\n" + src.read_text())


PROJECTS_UI = DESKTOP / "src" / "features" / "projects" / "ui"
# (file, anchor, replacement, marker) — each anchor must exist exactly once, so an upstream change
# that moves it fails the build loudly instead of silently dropping the tab.
PATCHES = [
    # Theme picker: the first-party "buzz" / "buzz-dark" themes show as "Unlimited" / "Unlimited Dark".
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     "function formatThemeLabel(name: string): string {\n  return name\n",
     "function formatThemeLabel(name: string): string {\n  return name.replace(/^buzz(?=-|$)/, \"unlimited\") // unlimited: theme label\n",
     "// unlimited: theme label"),
    # Agents page: no local agents, so no local "agent defaults" or "stop running agents" buttons.
    (DESKTOP / "src" / "features" / "agents" / "ui" / "AgentsView.tsx",
     "          <PageHeader\n            action={\n              <>\n",
     "          <PageHeader\n            action={\n              // Unlimited: employees run on the server only.\n              false && <>\n",
     "// Unlimited: employees run on the server only."),
    # Profile panel: server employees are the owner's agents (Harness log / Logs from the server, Edit = Profile).
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     'import { isRelayRemovedError } from "@/features/agents/managedAgentRelayCleanup";\n',
     'import { isRelayRemovedError } from "@/features/agents/managedAgentRelayCleanup";\n'
     'import { ServerEmployeeSettingsDialog } from "@/features/unlimited/agents/ServerEmployeeDialogs";\n'
     'import { ServerEmployeeLogView, useServerEmployee } from "@/features/unlimited/agents/ServerEmployeeProfileBridge";\n',
     "useServerEmployee } from"),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     "  const relayAgent = relayAgentsQuery.data?.find(\n",
     "  const serverEmployee = useServerEmployee(pubkeyLower);\n"
     "  const [serverEditOpen, setServerEditOpen] = React.useState(false);\n"
     "  const relayAgent = relayAgentsQuery.data?.find(\n",
     "const serverEmployee = useServerEmployee("),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     "  const isOwner = resolvedPersona ? true : managedAgentOwner;\n",
     "  const isOwner = resolvedPersona || serverEmployee ? true : managedAgentOwner;\n",
     "resolvedPersona || serverEmployee ? true"),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     "  const canEditAgent = Boolean(isOwner && (managedAgent ?? resolvedPersona));\n",
     "  const canEditAgent = Boolean(isOwner && (managedAgent ?? resolvedPersona ?? serverEmployee));\n",
     "resolvedPersona ?? serverEmployee"),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     '    isOwner === true && managedAgent?.backend.type === "local";\n',
     '    (isOwner === true && managedAgent?.backend.type === "local") || serverEmployee !== undefined;\n',
     '|| serverEmployee !== undefined;'),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     "    if (openResolvedPersonaEditor()) return;\n",
     "    if (serverEmployee) {\n      setServerEditOpen(true);\n      return;\n    }\n    if (openResolvedPersonaEditor()) return;\n",
     "setServerEditOpen(true);"),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     "  }, [openResolvedPersonaEditor, setEditAgentOpen]);\n",
     "  }, [openResolvedPersonaEditor, serverEmployee, setEditAgentOpen]);\n",
     "[openResolvedPersonaEditor, serverEmployee,"),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     '      {view === "diagnostics" ? (\n',
     '      {view === "diagnostics" && serverEmployee ? <ServerEmployeeLogView employee={serverEmployee} /> : null}\n'
     '      {view === "diagnostics" && !serverEmployee ? (\n',
     'view === "diagnostics" && serverEmployee'),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     '      {view === "logs" ? (\n',
     '      {view === "logs" && serverEmployee ? <ServerEmployeeLogView employee={serverEmployee} /> : null}\n'
     '      {view === "logs" && !serverEmployee ? (\n',
     'view === "logs" && serverEmployee'),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "UserProfilePanel.tsx",
     "      ) : null}\n    </AuxiliaryPanelBody>\n",
     "      ) : null}\n      <ServerEmployeeSettingsDialog\n"
     "        employee={serverEditOpen && serverEmployee ? serverEmployee : null}\n"
     "        onOpenChange={(o) => !o && setServerEditOpen(false)}\n      />\n    </AuxiliaryPanelBody>\n",
     "<ServerEmployeeSettingsDialog"),
    # Calls: the normal huddle button in a DM with a server employee opens the live voice call.
    (DESKTOP / "src" / "features" / "channels" / "ui" / "ChannelMembersBar.tsx",
     "  const huddleIndicator = (\n",
     "  // Unlimited: a DM with a server employee calls it live.\n"
     "  const unlimitedEmployee = useServerEmployeeIn(channel.channelType === \"dm\" ? channel.participantPubkeys : NO_PUBKEYS);\n"
     "  const huddleIndicator = unlimitedEmployee && variant !== \"compact\" ? (\n"
     "    <UnlimitedCallButton employee={unlimitedEmployee} />\n  ) : (\n",
     "// Unlimited: a DM with a server employee calls it live."),
    (DESKTOP / "src" / "features" / "channels" / "ui" / "ChannelMembersBar.tsx",
     'import { AddChannelBotDialog } from "./AddChannelBotDialog";\n',
     'import { AddChannelBotDialog } from "./AddChannelBotDialog";\n'
     'import { callServerEmployee, UnlimitedCallButton, useServerEmployeeIn } from "@/features/unlimited/agents/callStore";\n'
     'const NO_PUBKEYS: string[] = [];\n',
     'import { callServerEmployee, UnlimitedCallButton, useServerEmployeeIn }'),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "useProfileInteractionActions.ts",
     'import { normalizePubkey, truncateNpub } from "@/shared/lib/pubkey";\n',
     'import { normalizePubkey, truncateNpub } from "@/shared/lib/pubkey";\n'
     'import { callServerEmployee } from "@/features/unlimited/agents/callStore";\n',
     'import { callServerEmployee } from "@/features/unlimited/agents/callStore";'),
    (DESKTOP / "src" / "app" / "AppShellOverlays.tsx",
     'import * as React from "react";\n',
     'import * as React from "react";\nimport { UnlimitedCallHost } from "@/features/unlimited/agents/callStore";\n',
     'import { UnlimitedCallHost }'),
    (DESKTOP / "src" / "app" / "AppShellOverlays.tsx",
     "  return (\n    <>\n",
     "  return (\n    <>\n      <UnlimitedCallHost />\n",
     "<UnlimitedCallHost />"),
    (DESKTOP / "src" / "features" / "channels" / "ui" / "ChannelMembersBar.tsx",
     "      onStart={async () => {\n        try {\n          await startHuddle(\n",
     "      onStart={async () => {\n        try {\n"
     "          if (channel.channelType === \"dm\" && (await callServerEmployee([...huddleMemberPubkeys]))) return;\n"
     "          await startHuddle(\n",
     "await callServerEmployee([...huddleMemberPubkeys])"),
    (DESKTOP / "src" / "features" / "profile" / "ui" / "useProfileInteractionActions.ts",
     "      await goChannel(dm.id);\n      await startHuddle(dm.id, isBot ? [targetPubkey] : []);\n",
     "      await goChannel(dm.id);\n"
     "      if (await callServerEmployee([targetPubkey])) {\n        if (isMountedRef.current) onClose();\n        return;\n      }\n"
     "      await startHuddle(dm.id, isBot ? [targetPubkey] : []);\n",
     "await callServerEmployee([targetPubkey])"),
    # Add agents in a channel: the AI team by department first, then the agents on this computer.
    (DESKTOP / "src" / "features" / "channels" / "ui" / "AddChannelBotDialog.tsx",
     'import { AddChannelBotTeamsSection } from "@/features/channels/ui/AddChannelBotTeamsSection";\n',
     'import { AddChannelBotTeamsSection } from "@/features/channels/ui/AddChannelBotTeamsSection";\n'
     'import { useChannelMembersQuery } from "@/features/channels/hooks";\n'
     'import { ChannelTeamSection, useChannelTeamPick } from "@/features/unlimited/org/TeamPicker";\n',
     "useChannelTeamPick }"),
    (DESKTOP / "src" / "features" / "channels" / "ui" / "AddChannelBotDialog.tsx",
     "  const createBotsMutation = useCreateChannelManagedAgentsMutation(channelId);\n",
     "  const createBotsMutation = useCreateChannelManagedAgentsMutation(channelId);\n"
     "  const channelMembers = useChannelMembersQuery(channelId, open && channelId !== null);\n"
     "  const team = useChannelTeamPick(channelId, open, channelMembers.data?.map((m) => m.pubkey));\n",
     "const team = useChannelTeamPick("),
    (DESKTOP / "src" / "features" / "channels" / "ui" / "AddChannelBotDialog.tsx",
     "  async function handleSubmit() {\n    if (providers.length === 0 || selectedPersonas.length === 0) return;\n",
     "  async function handleSubmit() {\n"
     "    if (team.count > 0) {\n"
     "      try {\n        await team.submit();\n      } catch {\n        return;\n      }\n"
     "      if (selectedPersonas.length === 0) {\n        handleOpenChange(false);\n        return;\n      }\n"
     "    }\n"
     "    if (providers.length === 0 || selectedPersonas.length === 0) return;\n",
     "await team.submit();"),
    (DESKTOP / "src" / "features" / "channels" / "ui" / "AddChannelBotDialog.tsx",
     "  const canSubmit =\n    providers.length > 0 &&\n",
     "  const canSubmit =\n    (team.count > 0 && !team.pending && !createBotsMutation.isPending && (selectedPersonas.length === 0 || providers.length > 0)) ||\n    providers.length > 0 &&\n",
     "team.count > 0 && !team.pending"),
    (DESKTOP / "src" / "features" / "channels" / "ui" / "AddChannelBotDialog.tsx",
     "  const addButtonLabel = createBotsMutation.isPending\n",
     "  const pickedTotal = team.count + selectedPersonas.length;\n"
     "  const addButtonLabel = team.pending || createBotsMutation.isPending\n"
     "    ? \"Adding…\"\n"
     "    : team.count > 0\n"
     "      ? `Add ${pickedTotal} ${pickedTotal === 1 ? \"agent\" : \"agents\"}`\n"
     "      : createBotsMutation.isPending\n",
     "const pickedTotal = team.count"),
    (DESKTOP / "src" / "features" / "channels" / "ui" / "AddChannelBotDialog.tsx",
     '        footer={\n          <>\n            <Button\n              onClick={() => handleOpenChange(false)}\n',
     '        footer={\n          <>\n            {team.summary ? <span className="me-auto truncate text-xs text-muted-foreground">{team.summary}</span> : null}\n            <Button\n              onClick={() => handleOpenChange(false)}\n',
     "team.summary ? <span"),
    (DESKTOP / "src" / "features" / "channels" / "ui" / "AddChannelBotDialog.tsx",
     '        description="Choose from your agents, or create a new one."\n',
     '        description="Add your AI employees to this channel: pick a whole department, or open it and choose people."\n',
     "pick a whole department"),
    (DESKTOP / "src" / "features" / "channels" / "ui" / "AddChannelBotDialog.tsx",
     "        <AddChannelBotPersonasSection\n",
     "        <ChannelTeamSection team={team} />\n        <AddChannelBotPersonasSection\n",
     "<ChannelTeamSection team={team} />"),
    # No Buzz left in sight: token placeholder, bee emoji, hosted-repo label, runtime name.
    (DESKTOP / "src" / "features" / "communities" / "ui" / "EditCommunityDialog.tsx",
     'placeholder="buzz_..."',
     'placeholder="Optional access token"',
     'placeholder="Optional access token"'),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "SidebarProfileCard.tsx",
     '<span className="-translate-y-px leading-normal">🐝</span>',
     '<span className="-translate-y-px leading-normal">∞</span>',
     'leading-normal">∞</span>'),
    (DESKTOP / "src" / "features" / "communities" / "ui" / "CommunitySwitcher.tsx",
     '<span className="-translate-y-px leading-normal">🐝</span>',
     '<span className="-translate-y-px leading-normal">∞</span>',
     'leading-normal">∞</span>'),
    (DESKTOP / "src" / "features" / "projects" / "ui" / "RepositoryCards.tsx",
     '"Buzz-hosted repository"',
     '"Unlimited-hosted repository"',
     '"Unlimited-hosted repository"'),
    (DESKTOP / "src" / "features" / "onboarding" / "ui" / "DefaultConfigStep.tsx",
     'runtime.id === "buzz-agent" ? "Buzz" : runtime.label',
     'runtime.id === "buzz-agent" ? "Unlimited Agent" : runtime.label',
     '? "Unlimited Agent" : runtime.label'),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "BackupTestFlow.tsx",
     '"🐝", "🍯",',
     '"🚀", "⭐",',
     '"🚀", "⭐",'),
    (DESKTOP / "src" / "features" / "onboarding" / "ui" / "BackupTestFlow.tsx",
     '"🐝", "🍯",',
     '"🚀", "⭐",',
     '"🚀", "⭐",'),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "CommunityRail.tsx",
     '                ) : (\n                  getInitials(community.name) || "🐝"\n',
     '                ) : (\n                  getInitials(community.name) || "∞"\n',
     '                  getInitials(community.name) || "∞"'),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "CommunityRail.tsx",
     '      ) : (\n        getInitials(community.name) || "🐝"\n',
     '      ) : (\n        getInitials(community.name) || "∞"\n',
     '\n        getInitials(community.name) || "∞"'),
    # The bee "Welcome Team" (Fizz, Honey, Pollen) is Buzz's; it never shows in Unlimited Agent.
    (DESKTOP / "src" / "features" / "agents" / "hooks.ts",
     "    queryKey: personasQueryKey,\n    queryFn: listPersonas,\n",
     "    queryKey: personasQueryKey,\n"
     "    queryFn: async () =>\n"
     "      (await listPersonas()).filter((p) => ![\"builtin:fizz\", \"builtin:honey\", \"builtin:bumble\"].includes(p.id)),\n",
     '"builtin:fizz", "builtin:honey", "builtin:bumble"].includes(p.id)'),
    (DESKTOP / "src" / "features" / "agents" / "teamHooks.ts",
     "    queryKey: teamsQueryKey,\n    queryFn: listTeams,\n",
     "    queryKey: teamsQueryKey,\n"
     "    queryFn: async () =>\n"
     "      (await listTeams()).filter(\n"
     "        (t) => !(t.personaIds.length > 0 && t.personaIds.every((id) => [\"builtin:fizz\", \"builtin:honey\", \"builtin:bumble\"].includes(id))),\n"
     "      ),\n",
     'every((id) => ["builtin:fizz", "builtin:honey", "builtin:bumble"].includes(id))'),
    # Settings > Voice: paid voice for calls with employees.
    (DESKTOP / "src" / "features" / "settings" / "ui" / "VoiceSettingsCard.tsx",
     'import { SettingsSectionHeader } from "./SettingsSectionHeader";\n',
     'import { SettingsSectionHeader } from "./SettingsSectionHeader";\n'
     'import { CallsVoiceGroup } from "@/features/unlimited/voice/CallsVoiceGroup";\n',
     "import { CallsVoiceGroup }"),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "VoiceSettingsCard.tsx",
     "      </SettingsOptionGroupList>\n",
     "        <CallsVoiceGroup />\n      </SettingsOptionGroupList>\n",
     "<CallsVoiceGroup />"),
    # Mentions: the company's AI employees (from the Unlimited org) are always mentionable.
    (DESKTOP / "src" / "features" / "agents" / "lib" / "agentAutocompleteEligibility.ts",
     'import { normalizePubkey } from "@/shared/lib/pubkey";\n',
     'import { normalizePubkey } from "@/shared/lib/pubkey";\n'
     'import { unlimitedEmployeePubkeys } from "@/features/unlimited/org/employeePubkeys";\n',
     "unlimitedEmployeePubkeys } from"),
    (DESKTOP / "src" / "features" / "agents" / "lib" / "agentAutocompleteEligibility.ts",
     '  return pubkeys;\n}\n\nexport function isAgentIdentityInAllowedList(',
     '  for (const pk of unlimitedEmployeePubkeys()) pubkeys.add(pk);\n  return pubkeys;\n}\n\n'
     'export function isAgentIdentityInAllowedList(',
     "pubkeys.add(pk);\n  return pubkeys;"),
    # Task types: a fourth type for implementation work (the employee still decides code or setup in the plan).
    (DESKTOP / "src" / "features" / "projects" / "projectTaskCategories.ts",
     '  { label: "Improvement", value: "improvement" },\n] as const;',
     '  { label: "Improvement", value: "improvement" },\n  { label: "Implementation", value: "implementation" },\n] as const;',
     '"implementation"'),
    # Keychain: "unlimited-agent" instead of "buzz-desktop". The old item is one JSON blob; it is copied once and
    # checked before the new name is used, otherwise the app keeps the old name (never a new, empty identity).
    (DESKTOP / "src-tauri" / "src" / "app_state_keyring.rs",
     '    } else {\n        "buzz-desktop"\n    }\n}\n\npub(super) fn migration_marker_name(service: &str, default_name: &str) -> String {\n'
     '    if service == "buzz-desktop" || service == "buzz-desktop-dev" {\n',
     '    } else {\n'
     '        static SERVICE: std::sync::OnceLock<&\'static str> = std::sync::OnceLock::new();\n'
     '        *SERVICE.get_or_init(|| if unlimited_keychain_ready() { "unlimited-agent" } else { "buzz-desktop" })\n'
     '    }\n}\n\n'
     '/// Unlimited Agent: copy the secrets blob from the old "buzz-desktop" item to "unlimited-agent" once.\n'
     '/// True only when the new item holds everything (or there was nothing to copy).\n'
     '#[cfg(feature = "system-keyring")]\n'
     'fn unlimited_keychain_ready() -> bool {\n'
     '    use crate::secret_store::SecretStore;\n'
     '    let new = SecretStore::keyring("unlimited-agent");\n'
     '    match new.load_all_readonly() {\n'
     '        Ok(Some(_)) => return true,\n'
     '        Err(_) => return false,\n'
     '        Ok(None) => {}\n'
     '    }\n'
     '    let old = SecretStore::keyring("buzz-desktop");\n'
     '    let map = match old.load_all_readonly() {\n'
     '        Ok(None) => return true,\n'
     '        Ok(Some(map)) if map.is_empty() => return true,\n'
     '        Ok(Some(map)) => map,\n'
     '        Err(_) => return false,\n'
     '    };\n'
     '    if let Err(e) = new.store_all(&map) {\n'
     '        eprintln!("unlimited: keychain copy failed, keeping buzz-desktop: {e}");\n'
     '        return false;\n'
     '    }\n'
     '    let check = SecretStore::keyring("unlimited-agent");\n'
     '    let ok = matches!(check.load_all_readonly(), Ok(Some(ref m)) if map.iter().all(|(k, v)| m.get(k) == Some(v)));\n'
     '    eprintln!("unlimited: copied {} keychain secrets to unlimited-agent: {}", map.len(), if ok { "ok" } else { "mismatch" });\n'
     '    ok\n'
     '}\n\n'
     '#[cfg(not(feature = "system-keyring"))]\n'
     'fn unlimited_keychain_ready() -> bool {\n'
     '    false\n'
     '}\n\n'
     'pub(super) fn migration_marker_name(service: &str, default_name: &str) -> String {\n'
     '    if service == "buzz-desktop" || service == "buzz-desktop-dev" || service == "unlimited-agent" {\n',
     "fn unlimited_keychain_ready()"),
    # Odoo.sh sign-in inside the app (Settings > Connections): register the Rust command.
    (DESKTOP / "src-tauri" / "src" / "lib.rs",
     "mod app_menu;\n",
     "mod app_menu;\nmod unlimited_odoosh;\n",
     "mod unlimited_odoosh;"),
    (DESKTOP / "src-tauri" / "src" / "lib.rs",
     "        .invoke_handler(tauri::generate_handler![\n",
     "        .invoke_handler(tauri::generate_handler![\n            unlimited_odoosh::unlimited_odoosh_signin,\n",
     "unlimited_odoosh::unlimited_odoosh_signin"),
    (PROJECTS_UI / "ProjectWorkspaceTabList.tsx",
     '        <TabsTrigger className={PROJECT_TAB_TRIGGER_CLASS} value="contributors">\n'
     '          <ProjectTabLabel>Contributors</ProjectTabLabel>\n'
     '        </TabsTrigger>\n',
     '        <TabsTrigger className={PROJECT_TAB_TRIGGER_CLASS} value="contributors">\n'
     '          <ProjectTabLabel>Contributors</ProjectTabLabel>\n'
     '        </TabsTrigger>\n'
     '        <TabsTrigger className={PROJECT_TAB_TRIGGER_CLASS} value="odoo">\n'
     '          <ProjectTabLabel>Odoo & GitHub</ProjectTabLabel>\n'
     '        </TabsTrigger>\n',
     'value="odoo"'),
    (PROJECTS_UI / "ProjectWorkspaceTabs.tsx",
     'import { ProjectTabsList } from "./ProjectWorkspaceTabList";\n',
     'import { ProjectTabsList } from "./ProjectWorkspaceTabList";\n'
     'import { OdooProjectPanel } from "@/features/unlimited/odoo/OdooProjectPanel";\n',
     "OdooProjectPanel }"),
    (PROJECTS_UI / "ProjectWorkspaceTabs.tsx",
     '        <TabsContent className="m-0" value="contributors">\n',
     '        <TabsContent\n'
     '          className="m-0 min-h-0 flex-1 flex-col data-[state=active]:flex"\n'
     '          value="odoo"\n'
     '        >\n'
     '          <OdooProjectPanel buzzProjectId={project.id} projectName={project.name} />\n'
     '        </TabsContent>\n\n'
     '        <TabsContent className="m-0" value="contributors">\n',
     '<OdooProjectPanel buzzProjectId'),
    (PROJECTS_UI / "ProjectHomeContextPanel.tsx",
     'import { ProjectChannelManagement } from "./ProjectChannelManagement";\n',
     'import { ProjectChannelManagement } from "./ProjectChannelManagement";\n'
     'import { OdooContextSection } from "@/features/unlimited/odoo/OdooContextSection";\n',
     "OdooContextSection }"),
    (PROJECTS_UI / "ProjectHomeContextPanel.tsx",
     '      <ContextSection\n        collapsible\n        headerAction={\n          <ProjectChannelManagement\n',
     '      <OdooContextSection\n'
     '        onAddRepository={onAddRepository}\n'
     '        projectName={project.name}\n'
     '        repositoryId={firstRepository?.id ?? null}\n'
     '      />\n'
     '      <ContextSection\n        collapsible\n        headerAction={\n          <ProjectChannelManagement\n',
     "<OdooContextSection\n"),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     'import { SidebarMenuLabel } from "@/shared/ui/sidebar-menu-label";\n',
     'import { SidebarMenuLabel } from "@/shared/ui/sidebar-menu-label";\n'
     'import { OutboxSidebarEntry } from "@/features/unlimited/odoo/OutboxSidebarEntry";\n',
     "OutboxSidebarEntry }"),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     '          <ProtectedBestieSidebarEntry />\n',
     '          <ProtectedBestieSidebarEntry />\n          <OutboxSidebarEntry />\n',
     "<OutboxSidebarEntry />"),
    (DESKTOP / "src" / "features" / "huddle" / "components" / "AddAgentDialog.tsx",
     'import type { ManagedAgentBackend } from "@/shared/api/types";\n',
     'import type { ManagedAgentBackend } from "@/shared/api/types";\n'
     'import { loadServerAgents } from "@/features/unlimited/odoo/serverAgents";\n',
     "loadServerAgents }"),
    (DESKTOP / "src" / "features" / "huddle" / "components" / "AddAgentDialog.tsx",
     '    invoke<ManagedAgentSummary[]>("list_managed_agents")\n'
     '      .then((nextAgents) => {\n'
     '        if (!cancelled) setAgents(nextAgents);\n'
     '      })\n',
     '    // Unlimited: only the server employees are offered (no agents running on this computer).\n'
     '    loadServerAgents()\n'
     '      .then((serverAgents) => {\n'
     '        if (!cancelled) setAgents(serverAgents);\n'
     '      })\n',
     "only the server employees are offered"),
    # git runs credential helpers through the shell, so the bundled helper path
    # "/Applications/Unlimited Agent.app/..." splits at the space and project git auth fails.
    # Quote the path whenever it holds shell-special characters (paths without them are unchanged).
    (DESKTOP / "src-tauri" / "src" / "commands" / "project_git_exec.rs",
     "fn credential_helper_config_value(path: &std::path::Path) -> String {\n"
     "    path.to_string_lossy().replace('\\\\', \"/\")\n"
     "}\n",
     "fn credential_helper_config_value(path: &std::path::Path) -> String {\n"
     "    let value = path.to_string_lossy().replace('\\\\', \"/\");\n"
     "    // Unlimited: quote paths with spaces (app bundle is \"Unlimited Agent.app\").\n"
     "    if value.chars().any(|c| c.is_whitespace() || \"'\\\"$`;&|<>()*?![]{}#~\".contains(c)) {\n"
     "        // `!` makes git run the value as a shell snippet; a bare quoted path would be\n"
     "        // read as a helper *name* (\"git credential-'...'\").\n"
     "        format!(\"!'{}'\", value.replace('\\'', \"'\\\\''\"))\n"
     "    } else {\n"
     "        value\n"
     "    }\n"
     "}\n\n"
     "#[cfg(test)]\n"
     "#[test]\n"
     "fn unlimited_credential_helper_path_with_space_is_quoted() {\n"
     "    let path = std::path::PathBuf::from(\"/Applications/Unlimited Agent.app/Contents/MacOS/git-credential-nostr\");\n"
     "    assert_eq!(\n"
     "        credential_helper_config_value(&path),\n"
     "        \"!'/Applications/Unlimited Agent.app/Contents/MacOS/git-credential-nostr'\",\n"
     "    );\n"
     "}\n",
     "Unlimited: quote paths with spaces"),
    # Agents page: only the company's own agents — hide Buzz's built-in sample agents and team.
    (DESKTOP / "src" / "features" / "agents" / "ui" / "AgentsView.tsx",
     "              // Persona props\n"
     "              personas={personas.libraryPersonas}\n",
     "              // Persona props\n"
     "              personas={personas.libraryPersonas.filter((p) => !p.isBuiltIn)}\n",
     "libraryPersonas.filter((p) => !p.isBuiltIn)"),
    (DESKTOP / "src" / "features" / "agents" / "ui" / "AgentsView.tsx",
     'import { UnifiedAgentsSection } from "./UnifiedAgentsSection";\n',
     'import { UnifiedAgentsSection } from "./UnifiedAgentsSection";\n'
     'import { ServerAgentsSection } from "@/features/unlimited/agents/ServerAgentsSection";\n',
     "ServerAgentsSection } from"),
    (DESKTOP / "src" / "features" / "agents" / "ui" / "AgentsView.tsx",
     '          <div className="flex flex-col gap-8">\n'
     '            <UnifiedAgentsSection\n',
     '          <div className="flex flex-col gap-8">\n'
     '            <ServerAgentsSection />\n'
     '            {/* Unlimited: local (on-this-computer) agents and teams are not used; employees live on the server. */}\n'
     '            <div hidden>\n'
     '            <UnifiedAgentsSection\n',
     "<ServerAgentsSection />"),
    (DESKTOP / "src" / "features" / "agents" / "ui" / "AgentsView.tsx",
     "              teams={teamActions.teams}\n"
     "            />\n",
     "              teams={teamActions.teams.filter((t) => !t.isBuiltin)}\n"
     "            />\n"
     "            </div>\n",
     "teamActions.teams.filter("),
    # Task cycle (Task Desk): stage pill in each task row, cycle card + decisions inside a task.
    (PROJECTS_UI / "ProjectIssuesPanel.tsx",
     'import { ProjectPanelState } from "./ProjectPanelState";\n',
     'import { ProjectPanelState } from "./ProjectPanelState";\n'
     'import { TaskCycleCard } from "@/features/unlimited/tasks/TaskCycleCard";\n'
     'import { TaskStageCell } from "@/features/unlimited/tasks/TaskStageCell";\n',
     "TaskStageCell } from"),
    (PROJECTS_UI / "ProjectIssuesPanel.tsx",
     '      trailing={\n'
     '        <>\n'
     '          <span\n'
     '            className="hidden w-24 shrink-0 truncate text-right text-xs text-muted-foreground/60 md:block"\n',
     '      trailing={\n'
     '        <>\n'
     '          <TaskStageCell issueId={issue.id} project={project} />\n'
     '          <span\n'
     '            className="hidden w-24 shrink-0 truncate text-right text-xs text-muted-foreground/60 md:block"\n',
     "<TaskStageCell issueId"),
    (PROJECTS_UI / "ProjectIssuesPanel.tsx",
     '      </ProjectDetailMetaList>\n'
     '      {issue.content ? (\n',
     '      </ProjectDetailMetaList>\n'
     '      <TaskCycleCard issue={issue} project={project} />\n'
     '      {issue.content ? (\n',
     "<TaskCycleCard issue"),
    # Task details: a "Files" row with a View button for the files the employees made for the task.
    (PROJECTS_UI / "ProjectIssuesPanel.tsx",
     'import { TaskStageCell } from "@/features/unlimited/tasks/TaskStageCell";\n',
     'import { TaskStageCell } from "@/features/unlimited/tasks/TaskStageCell";\n'
     'import { TaskFilesRow } from "@/features/unlimited/tasks/AgentFiles";\n',
     "TaskFilesRow } from"),
    (PROJECTS_UI / "ProjectIssuesPanel.tsx",
     "        ) : null}\n      </ProjectDetailMetaList>\n",
     "        ) : null}\n        <TaskFilesRow issue={issue} />\n      </ProjectDetailMetaList>\n",
     "<TaskFilesRow issue"),
    # Usage: its own page under Projects in the sidebar (route /usage).
    (DESKTOP / "src" / "app" / "routes.ts",
     '  route("/projects", "projects.tsx"),\n',
     '  route("/projects", "projects.tsx"),\n  route("/usage", "usage.tsx"),\n',
     'route("/usage"'),
    (DESKTOP / "src" / "app" / "AppShell.helpers.ts",
     '  if (pathname === "/projects" || pathname.startsWith("/projects/")) {\n',
     '  if (pathname === "/usage" || pathname === "/projects" || pathname.startsWith("/projects/")) {\n',
     'pathname === "/usage"'),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     'import { OutboxSidebarEntry } from "@/features/unlimited/odoo/OutboxSidebarEntry";\n',
     'import { OutboxSidebarEntry } from "@/features/unlimited/odoo/OutboxSidebarEntry";\n'
     'import { UsageSidebarEntry } from "@/features/unlimited/usage/UsageSidebarEntry";\n',
     "UsageSidebarEntry }"),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     '                <SidebarMenuLabel>Projects</SidebarMenuLabel>\n'
     '              </SidebarMenuButton>\n'
     '            </SidebarMenuItem>\n'
     '          </FeatureGate>\n',
     '                <SidebarMenuLabel>Projects</SidebarMenuLabel>\n'
     '              </SidebarMenuButton>\n'
     '            </SidebarMenuItem>\n'
     '          </FeatureGate>\n'
     '          <UsageSidebarEntry />\n',
     "<UsageSidebarEntry />"),
    # Onboarding / communities: no Builderlab hosting, no local AI provider step, no Buzz help links.
    (DESKTOP / "src" / "features" / "communities" / "ui" / "WelcomeSetup.tsx",
     '                <Card\n'
     '                  asChild\n'
     '                  className={COMMUNITY_OPTION_CARD_CLASS}\n'
     '                  variant="textured"\n'
     '                >\n'
     '                  <button\n'
     '                    data-testid="community-choice-create"\n'
     '                    onClick={beginHostedCommunity}\n'
     '                    type="button"\n'
     '                  >\n'
     '                    Create a community\n'
     '                  </button>\n'
     '                </Card>\n',
     '                {/* Unlimited Agent: workspaces are created by Unlimited Solutions, not self-hosted here. */}\n',
     "workspaces are created by Unlimited Solutions"),
    (DESKTOP / "src" / "features" / "communities" / "ui" / "WelcomeSetup.tsx",
     '                    onClick={() => showPage("existing")}\n',
     '                    onClick={() => showPage("member") /* unlimited: no owner/Builderlab path */}\n',
     "unlimited: no owner/Builderlab path"),
    (DESKTOP / "src" / "features" / "communities" / "ui" / "WelcomeSetup.tsx",
     '                  Join or create a community\n',
     '                  Join your workspace\n',
     "Join your workspace"),
    (DESKTOP / "src" / "features" / "communities" / "ui" / "WelcomeSetup.tsx",
     '                  Join with an invite, create your own community, or reconnect\n'
     '                  one you already have.\n',
     '                  Open the invite link you received, or reconnect a workspace\n'
     '                  you already use.\n',
     "reconnect a workspace"),
    (DESKTOP / "src" / "features" / "communities" / "ui" / "WelcomeSetup.tsx",
     '                    I already have a community\n',
     '                    I already have a workspace\n',
     "I already have a workspace"),
    (DESKTOP / "src" / "features" / "communities" / "ui" / "WelcomeSetup.tsx",
     '                    showPage(page === "member" ? "existing" : "welcome")\n',
     '                    showPage("welcome") /* unlimited: member back */\n',
     "unlimited: member back"),
    (DESKTOP / "src" / "features" / "communities" / "ui" / "WelcomeSetup.tsx",
     '                onClick: () => showPage("existing"),\n'
     '                testId: "welcome-member-back",\n',
     '                onClick: () => showPage("welcome"),\n'
     '                testId: "welcome-member-back",\n',
     'onClick: () => showPage("welcome"),\n                testId: "welcome-member-back"'),
    (DESKTOP / "src" / "features" / "communities" / "ui" / "WelcomeSetup.tsx",
     '                    onClick={() => showPage("join")}\n'
     '                    type="button"\n'
     '                  >\n'
     '                    Join a community\n',
     '                    onClick={() => showPage("join")}\n'
     '                    type="button"\n'
     '                  >\n'
     '                    Join with an invite link\n',
     "Join with an invite link"),
    (DESKTOP / "src" / "features" / "communities" / "ui" / "AddCommunityDialog.tsx",
     '                className={OPTION_CLASS}\n'
     '                data-testid="add-community-create"\n',
     '                className="hidden" /* unlimited: no Builderlab hosting */\n'
     '                data-testid="add-community-create"\n',
     "unlimited: no Builderlab hosting"),
    # Settings > Connections: the workspace links its own GitHub, Odoo.sh, CICDoo and servers. It takes the
    # slot of Buzz's "Hosted communities" (Builderlab), which Unlimited Agent does not use.
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     'import { HostedCommunitiesSettingsCard } from "./HostedCommunitiesSettingsCard";\n',
     'import { ConnectionsScreen } from "@/features/unlimited/connections/ConnectionsScreen";\n',
     "ConnectionsScreen } from"),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     '      return <HostedCommunitiesSettingsCard />;\n',
     '      return <ConnectionsScreen embedded />;\n',
     "<ConnectionsScreen embedded />"),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     '    label: "Hosted communities",\n    icon: MessagesSquare,\n',
     '    label: "Connections",\n    icon: MessagesSquare,\n',
     'label: "Connections"'),
    (DESKTOP / "src" / "features" / "onboarding" / "welcomeCanvas.ts",
     'or read the [Buzz user guide](https://github.com/block/buzz#readme).',
     'or message Unlimited Solutions support.',
     "message Unlimited Solutions support"),
    (DESKTOP / "src" / "features" / "onboarding" / "ui" / "MachineOnboardingFlow.tsx",
     '  const chromeBackAction =\n',
     '  // Unlimited Agent: AI runs on the server employees, so people never connect an AI provider here.\n'
     '  React.useEffect(() => {\n'
     '    if (page === "setup") {\n'
     '      complete(selectedPubkey ?? undefined, { continueToProfile: !identityWasImported });\n'
     '    }\n'
     '    // eslint-disable-next-line react-hooks/exhaustive-deps\n'
     '  }, [page]);\n\n'
     '  const chromeBackAction =\n',
     "never connect an AI provider here"),
    # Menu-bar (tray) icon: infinity mark instead of the Buzz bee.
    (DESKTOP / "src-tauri" / "src" / "tray_menu.rs",
     '    fn bee_contains(x: f32, y: f32) -> bool {\n'
     '        let silhouette = circle_contains(x, y, 91.7, 154.5, 91.7)\n'
     '            || circle_contains(x, y, 374.3, 154.5, 91.7)\n'
     '            || rounded_rect_contains(x, y, 128.0, 0.0, 210.0, 309.0, 34.0);\n'
     '        let cutout = circle_contains(x, y, 193.3, 84.4, 27.0)\n'
     '            || circle_contains(x, y, 276.0, 84.4, 27.0)\n'
     '            || rounded_rect_contains(x, y, 166.3, 157.2, 136.9, 38.3, 5.0)\n'
     '            || rounded_rect_contains(x, y, 166.9, 235.1, 136.2, 37.6, 5.0);\n'
     '\n'
     '        silhouette && !cutout\n'
     '    }\n',
     '    fn bee_contains(x: f32, y: f32) -> bool {\n'
     '        // Unlimited Agent: the infinity mark (a lemniscate stroke) instead of the Buzz bee.\n'
     '        static POINTS: std::sync::OnceLock<Vec<(f32, f32)>> = std::sync::OnceLock::new();\n'
     '        const A: f32 = 205.0;\n'
     '        const HALF_STROKE: f32 = 21.0;\n'
     '        let points = POINTS.get_or_init(|| {\n'
     '            (0..720)\n'
     '                .map(|i| {\n'
     '                    let t = i as f32 * std::f32::consts::TAU / 720.0;\n'
     '                    let d = 1.0 + t.sin() * t.sin();\n'
     '                    (233.0 + A * t.cos() / d, 154.5 + A * t.sin() * t.cos() / d)\n'
     '                })\n'
     '                .collect()\n'
     '        });\n'
     '        let _ = (circle_contains as fn(f32, f32, f32, f32, f32) -> bool, rounded_rect_contains as fn(f32, f32, f32, f32, f32, f32, f32) -> bool);\n'
     '        points\n'
     '            .iter()\n'
     '            .any(|&(px, py)| (x - px) * (x - px) + (y - py) * (y - py) <= HALF_STROKE * HALF_STROKE)\n'
     '    }\n',
     "the infinity mark (a lemniscate stroke)"),
    # Settings: no local agents / shared compute (AI runs on the server); our own update feed.
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsView.tsx",
     '    sections: ["agents", "compute", "experimental", "mobile", "updates"],\n',
     '    sections: ["experimental", "mobile", "updates"],\n',
     'sections: ["experimental", "mobile", "updates"]'),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     'import { UpdateChecker } from "../UpdateChecker";\n',
     'import { UnlimitedUpdatesCard } from "@/features/unlimited/updates/UnlimitedUpdatesCard";\n',
     "UnlimitedUpdatesCard }"),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     '      return <UpdateChecker />;\n',
     '      return <UnlimitedUpdatesCard />;\n',
     "<UnlimitedUpdatesCard />"),
    # Workspaces (platform owner): its own page under Usage (route /workspaces).
    (DESKTOP / "src" / "app" / "routes.ts",
     '  route("/usage", "usage.tsx"),\n',
     '  route("/usage", "usage.tsx"),\n  route("/workspaces", "workspaces.tsx"),\n',
     'route("/workspaces"'),
    (DESKTOP / "src" / "app" / "AppShell.helpers.ts",
     '  if (pathname === "/usage" || pathname === "/projects"',
     '  if (pathname === "/usage" || pathname === "/workspaces" || pathname === "/projects"',
     'pathname === "/workspaces"'),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     'import { UsageSidebarEntry } from "@/features/unlimited/usage/UsageSidebarEntry";\n',
     'import { UsageSidebarEntry } from "@/features/unlimited/usage/UsageSidebarEntry";\n'
     'import { WorkspacesSidebarEntry } from "@/features/unlimited/workspaces/WorkspacesSidebarEntry";\n',
     "WorkspacesSidebarEntry }"),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     '          <UsageSidebarEntry />\n',
     '          <UsageSidebarEntry />\n          <WorkspacesSidebarEntry />\n',
     "<WorkspacesSidebarEntry />"),
    # Settings > Notifications: phone notifications from Unlimited Agent (APNs key, test) above the desktop ones.
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     'import { NotificationSettingsCard } from "./NotificationSettingsCard";\n',
     'import { NotificationSettingsCard } from "./NotificationSettingsCard";\n'
     'import { PhoneNotificationsCard } from "@/features/unlimited/notifications/PhoneNotificationsCard";\n',
     "import { PhoneNotificationsCard }"),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     '    case "notifications":\n      return (\n        <NotificationSettingsCard\n',
     '    case "notifications":\n      return (\n        <>\n        <PhoneNotificationsCard />\n        <NotificationSettingsCard\n',
     "<PhoneNotificationsCard />"),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     '          onSetSoundForSlot={props.onSetSoundForSlot}\n        />\n      );\n    case "voice":',
     '          onSetSoundForSlot={props.onSetSoundForSlot}\n        />\n        </>\n      );\n    case "voice":',
     "        </>\n      );\n    case \"voice\":"),
    # Today and Team (the org chart and the daily plan): own pages, first in the sidebar group.
    (DESKTOP / "src" / "app" / "routes.ts",
     '  route("/workspaces", "workspaces.tsx"),\n',
     '  route("/workspaces", "workspaces.tsx"),\n  route("/today", "today.tsx"),\n  route("/team", "team.tsx"),\n',
     'route("/today"'),
    (DESKTOP / "src" / "app" / "AppShell.helpers.ts",
     'pathname === "/workspaces" || ',
     'pathname === "/workspaces" || pathname === "/today" || pathname === "/team" || ',
     'pathname === "/today"'),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     'import { UsageSidebarEntry } from "@/features/unlimited/usage/UsageSidebarEntry";\n',
     'import { UsageSidebarEntry } from "@/features/unlimited/usage/UsageSidebarEntry";\n'
     'import { TeamSidebarEntry, TodaySidebarEntry } from "@/features/unlimited/org/OrgSidebarEntries";\n',
     "TodaySidebarEntry }"),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     '          <UsageSidebarEntry />\n          <WorkspacesSidebarEntry />\n',
     '          <TodaySidebarEntry />\n          <TeamSidebarEntry />\n          <UsageSidebarEntry />\n          <WorkspacesSidebarEntry />\n',
     "<TodaySidebarEntry />"),
    # Tasks: every project's tasks on one page, first in the group (after the Today/Team patches above).
    (DESKTOP / "src" / "app" / "routes.ts",
     '  route("/today", "today.tsx"),\n',
     '  route("/tasks", "tasks.tsx"),\n  route("/today", "today.tsx"),\n',
     'route("/tasks"'),
    (DESKTOP / "src" / "app" / "AppShell.helpers.ts",
     'pathname === "/today" || ',
     'pathname === "/tasks" || pathname === "/today" || ',
     'pathname === "/tasks"'),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     'import { TeamSidebarEntry, TodaySidebarEntry } from "@/features/unlimited/org/OrgSidebarEntries";\n',
     'import { TasksSidebarEntry, TeamSidebarEntry, TodaySidebarEntry } from "@/features/unlimited/org/OrgSidebarEntries";\n',
     "TasksSidebarEntry, TeamSidebarEntry"),
    (DESKTOP / "src" / "features" / "sidebar" / "ui" / "AppSidebarPinnedHeader.tsx",
     '          <TodaySidebarEntry />\n',
     '          <TasksSidebarEntry />\n          <TodaySidebarEntry />\n',
     "<TasksSidebarEntry />"),
    # Settings > AI provider (under Connections): Claude accounts, usage, switching, models per employee.
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     '  | "hosted-communities"\n  | "community-members"\n',
     '  | "hosted-communities"\n  | "ai-provider"\n  | "community-members"\n',
     '| "ai-provider"'),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     '  "hosted-communities",\n  "community-members",\n',
     '  "hosted-communities",\n  "ai-provider",\n  "community-members",\n',
     '  "ai-provider",\n'),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     '    label: "Connections",\n    icon: MessagesSquare,\n  },\n',
     '    label: "Connections",\n    icon: MessagesSquare,\n  },\n'
     '  {\n    value: "ai-provider",\n    label: "AI provider",\n    icon: AiProviderIcon,\n  },\n',
     'label: "AI provider"'),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     'import { ConnectionsScreen } from "@/features/unlimited/connections/ConnectionsScreen";\n',
     'import { ConnectionsScreen } from "@/features/unlimited/connections/ConnectionsScreen";\n'
     'import { AiProviderIcon, AiProviderScreen } from "@/features/unlimited/ai/AiProviderScreen";\n',
     "AiProviderScreen } from"),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsPanels.tsx",
     '      return <ConnectionsScreen embedded />;\n',
     '      return <ConnectionsScreen embedded />;\n    case "ai-provider":\n      return <AiProviderScreen />;\n',
     "return <AiProviderScreen />"),
    (DESKTOP / "src" / "features" / "settings" / "ui" / "SettingsView.tsx",
     '    sections: ["hosted-communities", "community-members", "relay-admin"],\n',
     '    sections: ["hosted-communities", "ai-provider", "community-members", "relay-admin"],\n',
     '"hosted-communities", "ai-provider"'),
    # First screen: the Unlimited welcome (hero + sign in by invite email or link) instead of "Create a new identity key".
    (DESKTOP / "src" / "features" / "onboarding" / "ui" / "MachineOnboardingFlow.tsx",
     'import { StartupWindowDragRegion } from "@/shared/ui/StartupWindowDragRegion";\n',
     'import { StartupWindowDragRegion } from "@/shared/ui/StartupWindowDragRegion";\n'
     'import { UnlimitedWelcome } from "@/features/unlimited/join/UnlimitedWelcome";\n',
     "import { UnlimitedWelcome }"),
    (DESKTOP / "src" / "features" / "onboarding" / "ui" / "MachineOnboardingFlow.tsx",
     '  if (page === "identity") {\n    return (\n      <div\n',
     '  if (page === "identity") {\n'
     '    return (\n'
     '      <UnlimitedWelcome\n'
     '        complete={complete}\n'
     '        onExistingKey={(mode) => {\n'
     '          setError(null);\n'
     '          setKeyImportStage("key-entry");\n'
     '          setKeyImportDialog(mode === "phone" ? "phone" : null);\n'
     '          if (mode === "phone") setPhoneRecoveryStep("loading");\n'
     '          setTransitionDirection("forward");\n'
     '          setPage("key-import");\n'
     '        }}\n'
     '      />\n'
     '    );\n'
     '  }\n'
     '  if ((page as string) === "buzz-identity") {\n    return (\n      <div\n',
     "<UnlimitedWelcome"),
]


ON_BY_DEFAULT = {"projects"}  # core to Unlimited Agent: Odoo & GitHub live inside projects


def brand_features(check: bool) -> None:
    """Turn our core preview features on by default (users can still toggle them)."""
    path = ROOT / "preview-features.json"
    data = json.loads(path.read_text())
    for f in data.get("features", []):
        if f.get("id") in ON_BY_DEFAULT:
            f["defaultEnabled"] = True
    if not check:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


HUDDLE = DESKTOP / "src-tauri" / "src" / "huddle"
VOICE_PACK_URL = ("https://github.com/ma44588/unlimited-buzz/releases/download/voice-pack-v2/"
                  "unlimited-voice-v2.tar.bz2")
VOICE_PACK_SHA256 = "b817c9cafc368f8d71272e8bf552f26c7a6c82f60d6e499bce13a5c6e1e4de15"
VOICE_LICENSE = (
    "Unlimited Agent voice pack v2\\n\\n"
    "Speech-to-text: OpenAI Whisper large-v3-turbo (MIT), int8 export by sherpa-onnx; Arabic and English.\\n"
    "Voice: Nabra-82M v0.1 (oddadmix), Apache-2.0, https://huggingface.co/oddadmix/Nabra-82M-v0.1\\n"
    "Both packaged for sherpa-onnx (https://github.com/k2-fsa/sherpa-onnx). Provided AS IS, without warranty.\\n"
)


def _sub(text: str, pattern: str, repl: str, path: Path, flags: int = 0) -> str:
    new, n = re.subn(pattern, lambda _m: repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"brand.py: arabic voice pattern not found in {path.name}: {pattern[:60]}")
    return new


def brand_arabic_voice(check: bool) -> None:
    """Huddles in Arabic + English: Whisper turbo STT + Nabra TTS (local), shipped as one voice pack."""
    models = HUDDLE / "models.rs"
    s = models.read_text()
    if "unlimited-voice-v2" not in s:
        s = _sub(s, r'const STT_ARCHIVE_SHA256: &str = "[0-9a-f]+";',
                 f'const STT_ARCHIVE_SHA256: &str = "{VOICE_PACK_SHA256}";', models)
        s = _sub(s, r'const STT_MODEL_VERSION: &str = "\d+";', 'const STT_MODEL_VERSION: &str = "4";', models)
        s = _sub(s, r"const MAX_STT_DOWNLOAD_BYTES: u64 = [^;]+;",
                 "const MAX_STT_DOWNLOAD_BYTES: u64 = 900 * 1024 * 1024;", models)
        s = _sub(s, r"const STT_DOWNLOAD_URL: &str =\s*\"[^;]*\";",
                 f'const STT_DOWNLOAD_URL: &str = "{VOICE_PACK_URL}";', models, re.S)
        s = _sub(s, r'const STT_ARCHIVE_SUBDIR: &str = "[^"]+";',
                 'const STT_ARCHIVE_SUBDIR: &str = "unlimited-voice-v2";', models)
        s = _sub(s, r'const STT_MODEL_DIR_NAME: &str = "[^"]+";',
                 'const STT_MODEL_DIR_NAME: &str = "unlimited-voice-v2";', models)
        s = _sub(s, r"const STT_EXPECTED_FILES: &\[&str\] = &\[[^\]]*\];",
                 'const STT_EXPECTED_FILES: &[&str] = &["turbo-encoder.int8.onnx", "turbo-decoder.int8.onnx", '
                 '"turbo-tokens.txt", "nabra/model.int8.onnx", "nabra/voices.bin", STT_LICENSE_FILE_NAME];', models)
        s = _sub(s, r'const STT_LICENSE_TEXT: &str = "\\\n.*?";\n',
                 f'const STT_LICENSE_TEXT: &str = "{VOICE_LICENSE}";\n', models, re.S)
        if not check:
            models.write_text(s)
    stt = HUDDLE / "stt.rs"
    s = stt.read_text()
    if "turbo-encoder" not in s:
        s = _sub(s, r'let tokens_path = model_dir\.join\("tokens\.txt"\);\n\s*let model_path = model_dir\.join\("model\.int8\.onnx"\);\n\s*if !tokens_path\.exists\(\) \|\| !model_path\.exists\(\) \{',
                 'let tokens_path = model_dir.join("turbo-tokens.txt");\n'
                 '    let model_path = model_dir.join("turbo-encoder.int8.onnx");\n'
                 '    let decoder_path = model_dir.join("turbo-decoder.int8.onnx");\n'
                 '    if !tokens_path.exists() || !model_path.exists() || !decoder_path.exists() {', stt)
        s = _sub(s, r"cfg\.model_config\.nemo_ctc\.model = Some\(model_path\.to_string_lossy\(\)\.into_owned\(\)\);",
                 "// Unlimited: Whisper large-v3-turbo, language auto-detected per utterance (Arabic + English).\n"
                 "    cfg.model_config.whisper.encoder = Some(model_path.to_string_lossy().into_owned());\n"
                 "    cfg.model_config.whisper.decoder = Some(decoder_path.to_string_lossy().into_owned());\n"
                 "    cfg.model_config.whisper.language = Some(String::new());\n"
                 "    cfg.model_config.whisper.task = Some(\"transcribe\".to_string());\n"
                 "    cfg.model_config.whisper.tail_paddings = -1;", stt)
        s = _sub(s, r"    let stream = recognizer\.create_stream\(\);\n    stream\.accept_waveform\(16_000, speech_buf\);\n    recognizer\.decode\(&stream\);\n\n    stream\n        \.get_result\(\)\n        \.map\(\|r\| r\.text\.trim\(\)\.to_string\(\)\)\n        \.unwrap_or_default\(\)",
                 "    // Unlimited: pad with silence so Whisper does not cut the last word, then drop\n"
                 "    // the phrases it invents on silence or noise.\n"
                 "    let mut padded = vec![0.0f32; 4_800];\n"
                 "    padded.extend_from_slice(speech_buf);\n"
                 "    padded.extend(std::iter::repeat(0.0f32).take(24_000));\n"
                 "    let stream = recognizer.create_stream();\n"
                 "    stream.accept_waveform(16_000, &padded);\n"
                 "    recognizer.decode(&stream);\n"
                 "    let text = stream.get_result().map(|r| r.text.trim().to_string()).unwrap_or_default();\n"
                 "    super::unlimited_stt_filter::clean(&text)", stt)
        if not check:
            stt.write_text(s)
    mod_rs = HUDDLE / "mod.rs"
    m = mod_rs.read_text()
    if "unlimited_stt_filter" not in m:
        m = m.rstrip("\n") + "\n\n// Unlimited: drop Whisper hallucinations from huddle transcripts.\npub(crate) mod unlimited_stt_filter;\n"
        if not check:
            mod_rs.write_text(m)
    pre = HUDDLE / "preprocessing.rs"
    s = pre.read_text()
    if "has_arabic" not in s:
        s = _sub(s, r"    let s = expand_numbers\(&s\);\n",
                 "    // Unlimited: Arabic voice reads digits natively; English words would break it.\n"
                 "    let s = if super::pocket::has_arabic(&s) { s } else { expand_numbers(&s) };\n", pre)
        if not check:
            pre.write_text(s)


def brand_patches(check: bool) -> int:
    n = 0
    for path, anchor, repl, marker in PATCHES:
        text = path.read_text()
        if marker in text:
            continue
        if text.count(anchor) != 1:
            raise SystemExit(f"brand.py: anchor not found exactly once in {path.relative_to(ROOT)}")
        n += 1
        if not check:
            path.write_text(text.replace(anchor, repl))
    return n


def brand_usage_route(check: bool) -> None:
    """Add our top-level pages to the generated route tree (mirrors the /agents entries)."""
    for name in ("usage", "workspaces", "today", "team", "tasks"):
        brand_route(name, check)


def brand_route(name: str, check: bool) -> None:
    path = DESKTOP / "src" / "app" / "routeTree.gen.ts"
    text = path.read_text()
    if f"{name}Route" in text:
        return
    pairs = [
        ('import { Route as agentsRouteImport } from "./routes/agents";\n',
         'import { Route as usageRouteImport } from "./routes/usage";\n'),
        ('const agentsRoute = agentsRouteImport.update({\n  id: "/agents",\n  path: "/agents",\n'
         '  getParentRoute: () => rootRouteImport,\n} as any);\n',
         'const usageRoute = usageRouteImport.update({\n  id: "/usage",\n  path: "/usage",\n'
         '  getParentRoute: () => rootRouteImport,\n} as any);\n'),
        ('  "/agents": typeof agentsRoute;\n', '  "/usage": typeof usageRoute;\n'),
        ('    | "/agents"\n', '    | "/usage"\n'),
        ('  agentsRoute: typeof agentsRoute;\n', '  usageRoute: typeof usageRoute;\n'),
        ('    "/agents": {\n      id: "/agents";\n      path: "/agents";\n      fullPath: "/agents";\n'
         '      preLoaderRoute: typeof agentsRouteImport;\n      parentRoute: typeof rootRouteImport;\n    };\n',
         '    "/usage": {\n      id: "/usage";\n      path: "/usage";\n      fullPath: "/usage";\n'
         '      preLoaderRoute: typeof usageRouteImport;\n      parentRoute: typeof rootRouteImport;\n    };\n'),
        ('  agentsRoute: agentsRoute,\n', '  usageRoute: usageRoute,\n'),
    ]
    pairs = [(a, e.replace("usage", name)) for a, e in pairs]
    for anchor, extra in pairs:
        if anchor not in text:
            raise SystemExit(f"brand.py: route tree anchor missing: {anchor.strip()[:40]}")
        text = text.replace(anchor, anchor + extra)
    if not check:
        path.write_text(text)


def main() -> None:
    check = "--check" in sys.argv
    brand_tauri_conf(check)
    brand_installer(check)
    brand_theme(check)
    brand_features(check)
    brand_arabic_voice(check)
    print(f"patches: {brand_patches(check)} applied")
    brand_usage_route(check)
    print(f"overrides: {brand_overrides(check)} files")
    n = brand_ui_strings(check)
    print(f"{'would replace' if check else 'replaced'} {n} user-facing 'Buzz' occurrences; product = {NAME}")


if __name__ == "__main__":
    main()
