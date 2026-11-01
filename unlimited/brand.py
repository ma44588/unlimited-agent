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
    for name in ("usage", "workspaces"):
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
