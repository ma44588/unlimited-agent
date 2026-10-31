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


def main() -> None:
    check = "--check" in sys.argv
    brand_tauri_conf(check)
    brand_installer(check)
    print(f"overrides: {brand_overrides(check)} files")
    n = brand_ui_strings(check)
    print(f"{'would replace' if check else 'replaced'} {n} user-facing 'Buzz' occurrences; product = {NAME}")


if __name__ == "__main__":
    main()
