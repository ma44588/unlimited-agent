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


def main() -> None:
    xcconfig()
    info_plist()
    artwork()
    app_icons()
    print(f"mobile: bundle {BUNDLE}, {dart_strings()} string lines branded, team {'set' if TEAM else 'none'}")


if __name__ == "__main__":
    sys.exit(main())
