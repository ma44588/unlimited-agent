#!/usr/bin/env python3
"""Brand the Flutter mobile client as "Unlimited Agent" (run from the repo root, after `flutter pub get`).

What it changes (idempotent):
- iOS build settings: bundle id, display name, development team (from UNLIMITED_TEAM_ID, empty for
  simulator builds).
- Info.plist bundle name.
- User-facing Dart string literals that say "Buzz".
- Welcome artwork (mark + wordmark) and the iOS app icon set (from unlimited/brand/icon-1024.png).
Deep links keep the buzz:// scheme so invites from the desktop and the web keep working.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOBILE = ROOT / "mobile"
BRAND = ROOT / "unlimited" / "brand"
OVERRIDES = ROOT / "unlimited" / "overrides" / "mobile"
NAME = "Unlimited Agent"
BUNDLE = os.environ.get("UNLIMITED_BUNDLE_ID", "technology.unlimitedsolutions.agent")
TEAM = os.environ.get("UNLIMITED_TEAM_ID", "")


def set_kv(text: str, key: str, value: str) -> str:
    return re.sub(rf"^{key} = .*$", f"{key} = {value}", text, flags=re.M)


def xcconfig() -> None:
    for name, bundle in (("Debug.xcconfig", f"{BUNDLE}.dev"), ("Release.xcconfig", BUNDLE)):
        p = MOBILE / "ios" / "Flutter" / name
        t = p.read_text()
        t = set_kv(t, "BUNDLE_IDENTIFIER", bundle)
        t = set_kv(t, "APP_DISPLAY_NAME", NAME)
        t = set_kv(t, "BUZZ_DEVELOPMENT_TEAM", TEAM)
        p.write_text(t)


def info_plist() -> None:
    p = MOBILE / "ios" / "Runner" / "Info.plist"
    t = p.read_text()
    t = t.replace("<key>CFBundleName</key>\n\t<string>Buzz</string>", f"<key>CFBundleName</key>\n\t<string>{NAME}</string>")
    p.write_text(t)


LITERAL = re.compile(r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"")


def _brand_literal(m: re.Match) -> str:
    s = m.group(0)
    s = s.replace("Buzz Desktop", f"{NAME} on your computer")
    s = s.replace("Buzz's", f"{NAME}'s").replace("Buzz’s", f"{NAME}’s")
    return re.sub(r"\bBuzz\b(?![A-Za-z])", NAME, s)


def dart_strings() -> int:
    n = 0
    for p in (MOBILE / "lib").rglob("*.dart"):
        lines = p.read_text().split("\n")
        changed = False
        for i, line in enumerate(lines):
            stripped = line.lstrip()
            if stripped.startswith(("//", "import ", "export ", "part ")) or "Buzz" not in line:
                continue
            new = LITERAL.sub(_brand_literal, line)
            if new != line:
                lines[i], changed = new, True
                n += 1
        if changed:
            p.write_text("\n".join(lines))
    return n


def artwork() -> None:
    for src in (OVERRIDES / "assets" / "images").glob("*.png"):
        shutil.copyfile(src, MOBILE / "assets" / "images" / src.name)


def app_icons() -> None:
    icon_set = MOBILE / "ios" / "Runner" / "Assets.xcassets" / "AppIcon.appiconset"
    master = BRAND / "icon-1024.png"
    images = json.loads((icon_set / "Contents.json").read_text())["images"]
    for img in images:
        fname = img.get("filename")
        if not fname:
            continue
        base = float(img["size"].split("x")[0])
        px = int(round(base * int(img["scale"].rstrip("x"))))
        out = icon_set / fname
        try:  # App Store icons must not have an alpha channel, so flatten onto white.
            from PIL import Image
            src = Image.open(master).convert("RGBA")
            flat = Image.new("RGB", src.size, (255, 255, 255))
            flat.paste(src, mask=src.split()[3])
            flat.resize((px, px), Image.LANCZOS).save(out)
        except ImportError:
            subprocess.run(["sips", "-s", "format", "png", "-z", str(px), str(px), str(master), "--out", str(out)],
                           check=True, capture_output=True)


HERO_OLD = """                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 320),
                            child: AspectRatio(
                              aspectRatio: 777 / 326,
                              child: Semantics(
                                // Hidden developer entry intentionally has no
                                // keyboard shortcut. Keep its assistive action
                                // on the existing labelled wordmark node.
                                customSemanticsActions: canRevealOptions
                                    ? {
                                        const CustomSemanticsAction(
                                          label: 'More connection options',
                                        ): revealOptions,
                                      }
                                    : null,
                                child: OnboardingWordmark(
                                  key: const Key('pairing-buzz-wordmark'),
                                  color: context._onboardingIsDark
                                      ? context._onboardingInk
                                      : null,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: Grid.xxs),
                          Text(
                            'Your people, your agents, your projects —\\nall in one place.',
                            textAlign: TextAlign.center,
                            style: context.textTheme.bodyLarge?.copyWith(
                              color: context._onboardingInk,
                            ),
                          ),
                        ],
                      ),
                    ),"""
HERO_NEW = """                    child: Semantics(
                      // Hidden developer entry intentionally has no keyboard
                      // shortcut. Keep its assistive action on the hero.
                      customSemanticsActions: canRevealOptions
                          ? {
                              const CustomSemanticsAction(
                                label: 'More connection options',
                              ): revealOptions,
                            }
                          : null,
                      child: const Padding(
                        padding: EdgeInsets.only(top: Grid.xxs),
                        child: UnlimitedHero(key: Key('pairing-buzz-wordmark')),
                      ),
                    ),"""
ACTIONS_OLD = """    List<Widget> connectionActions() => [
      const SizedBox(height: Grid.xxs),
      FilledButton(
        style: context._onboardingGlassButtonStyle,
        onPressed: onCommunityLink,
        child: const Text('Enter a community link'),
      ),
      const SizedBox(height: Grid.xxs),
      GestureDetector(
        key: const Key('developer-pairing-trigger'),
        excludeFromSemantics: true,
        onDoubleTap: isBusy ? null : onAlreadyUseBuzz,
        child: FilledButton(
          style: context._onboardingGlassButtonStyle,
          onPressed: isBusy ? null : onScan,
          child: const Text('Scan a QR code'),
        ),
      ),
    ];"""
ACTIONS_NEW = """    List<Widget> connectionActions() => [
      const SizedBox(height: Grid.xxs),
      GestureDetector(
        key: const Key('developer-pairing-trigger'),
        excludeFromSemantics: true,
        onDoubleTap: isBusy ? null : onAlreadyUseBuzz,
        child: SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: context._onboardingButtonStyle,
            onPressed: isBusy ? null : onScan,
            child: const Text('Scan the QR on your computer'),
          ),
        ),
      ),
      const SizedBox(height: Grid.xs - 6),
      SizedBox(
        width: double.infinity,
        child: TextButton(
          style: context._onboardingSecondaryButtonStyle,
          onPressed: onCommunityLink,
          child: const Text('I have an invite link'),
        ),
      ),
      const SizedBox(height: Grid.twelve),
      const _UnlimitedTrustRow(),
    ];"""


PATCHES = [
    # Top-section gradient: Unlimited purple wash (desktop --buzz-gradient-* in unlimited/brand/theme.css).
    ("lib/shared/theme/buzz_theme.dart", "const _lightTop = Color(0xFFE6E6B6);", "const _lightTop = Color(0xFFEEE5F6);"),
    ("lib/shared/theme/buzz_theme.dart", "const _lightBottom = Color(0xFFC4D0DA);", "const _lightBottom = Color(0xFFF8E5EF);"),
    ("lib/shared/theme/buzz_theme.dart", "const _darkTop = Color(0xFF4A4616);", "const _darkTop = Color(0xFF26113A);"),
    ("lib/shared/theme/buzz_theme.dart", "const _darkBottom = Color(0xFF0A1423);", "const _darkBottom = Color(0xFF3A1430);"),
    # Accent: the desktop brand purple instead of neutral black.
    ("lib/shared/theme/buzz_theme.dart", "  if (isBuzzTheme(themeName)) return neutralAccentIndex;",
     "  if (isBuzzTheme(themeName)) return unlimitedAccentIndex;"),
    ("lib/shared/theme/accent_colors.dart", "\nconst accentColors = [\n",
     "\nconst accentColors = [\n  AccentColor(\n    name: 'Unlimited',\n    light: Color(0xFF7A4794),\n"
     "    dark: Color(0xFFC79FDB),\n    wireValue: '#7a4794',\n  ),\n"),
    ("lib/shared/theme/accent_colors.dart", "const neutralAccentIndex = 0;",
     "const neutralAccentIndex = 1;\n\n/// Unlimited Agent brand purple (first entry).\nconst unlimitedAccentIndex = 0;"),
    ("lib/shared/theme/accent_colors.dart", "const defaultAccentIndex = neutralAccentIndex;",
     "const defaultAccentIndex = unlimitedAccentIndex;"),
    # Welcome hero: the landing page look (see overrides/mobile/lib/.../unlimited_hero.dart).
    ("lib/features/pairing/pairing_page.dart", "import 'pairing_page/onboarding_wordmark.dart';",
     "import 'pairing_page/unlimited_hero.dart';"),
    ("lib/features/pairing/pairing_page/pairing_welcome_view.dart", HERO_OLD, HERO_NEW),
    ("lib/features/pairing/pairing_page/pairing_welcome_view.dart", ACTIONS_OLD, ACTIONS_NEW),
    ("lib/features/pairing/pairing_page/pairing_welcome_view.dart",
     "                  FilledButton(\n                    style: context._onboardingGlassButtonStyle,\n                    onPressed: isBusy ? null : onScan,\n                    child: isBusy && !pairingCodeExpanded",
     "                  FilledButton(\n                    style: context._onboardingButtonStyle,\n                    onPressed: isBusy ? null : onScan,\n                    child: isBusy && !pairingCodeExpanded"),
    ("lib/features/pairing/pairing_page/pairing_welcome_view.dart",
     "                        : const Text('Scan a QR code'),\n                  ),\n                  const SizedBox(height: Grid.xxs),",
     "                        : const Text('Scan the QR on your computer'),\n                  ),\n                  const SizedBox(height: Grid.xxs),"),
    ("lib/features/pairing/pairing_page/pairing_welcome_view.dart",
     "                          : 'Use pairing code',", "                          : 'Paste a pairing link',"),
    # Team, Projects and Outbox from the Unlimited server (no local agents on the phone).
    ("lib/app.dart", "import 'features/agents/agents_page.dart';",
     "import 'features/agents/agents_page.dart';\nimport 'features/unlimited/unlimited_hub_page.dart';"),
    ("lib/app.dart", "              onAgents: showAgents,", "              onAgents: (c) => showUnlimitedHub(c),"),
    ("lib/features/home/home_page.dart", "            label: 'Agents',\n            symbol: 'person.2',",
     "            label: 'Team',\n            symbol: 'person.2',"),
    # Deep night palette for the app's dark mode, and dark by default.
    ("lib/shared/theme/theme_catalog.dart",
     "    name: 'buzz-dark',\n    bg: Color(0xFF24292E),\n    fg: Color(0xFFE1E4E8),\n    comment: Color(0xFF6A737D),",
     "    name: 'buzz-dark',\n    bg: Color(0xFF0C0814),\n    fg: Color(0xFFF4F0FA),\n    comment: Color(0xFFB4A9C7),"),
    ("lib/shared/theme/theme_catalog.dart",
     "    name: 'buzz',\n    bg: Color(0xFFFFFFFF),\n    fg: Color(0xFF24292E),\n    comment: Color(0xFF6A737D),",
     "    name: 'buzz',\n    bg: Color(0xFFFFFFFF),\n    fg: Color(0xFF1D1A22),\n    comment: Color(0xFF6B6475),"),
    ("lib/shared/theme/buzz_theme.dart", "const _darkTop = Color(0xFF26113A);", "const _darkTop = Color(0xFF2A1442);"),
    ("lib/shared/theme/buzz_theme.dart", "const _darkBottom = Color(0xFF3A1430);", "const _darkBottom = Color(0xFF150B24);"),
    ("lib/shared/theme/theme_provider.dart", "          ThemeMode.system;\n    }\n    return ThemeMode.system;",
     "          ThemeMode.system;\n    }\n    return ThemeMode.dark;"),
]


def patches() -> int:
    n = 0
    for rel, old, new in PATCHES:
        p = MOBILE / rel
        t = p.read_text()
        if new in t:
            continue
        if old not in t:
            raise SystemExit(f"brand_mobile: anchor missing in {rel}: {old[:50]}")
        p.write_text(t.replace(old, new, 1))
        n += 1
    return n


def lib_overrides() -> int:
    n = 0
    for src in (OVERRIDES / "lib").rglob("*.dart"):
        dst = MOBILE / "lib" / src.relative_to(OVERRIDES / "lib")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        n += 1
    return n


def main() -> None:
    print(f"mobile: {lib_overrides()} lib overrides")
    print(f"mobile: {patches()} theme patches")
    xcconfig()
    info_plist()
    artwork()
    app_icons()
    print(f"mobile: bundle {BUNDLE}, {dart_strings()} string lines branded, team {'set' if TEAM else 'none'}")


if __name__ == "__main__":
    sys.exit(main())
