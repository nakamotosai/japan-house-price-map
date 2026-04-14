#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


REQUIRED_SECTIONS = [
    "## 当前状态",
    "## 当前数据口径",
    "## 本轮收口验证",
    "## 当前边界",
    "## 仓库卫生要求",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check README closeout requirements for 日本房价地图.",
    )
    parser.add_argument("project_root", help="Project root")
    parser.add_argument(
        "--expect-clean",
        action="store_true",
        help="Require git worktree to be clean",
    )
    return parser.parse_args()


def run_git(project_root: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(project_root), *args],
        text=True,
    ).strip()


def main() -> int:
    args = parse_args()
    project_root = Path(args.project_root).resolve()
    readme = project_root / "README.md"
    ok = True
    errors: list[str] = []

    if not readme.exists():
        ok = False
        errors.append("README.md 不存在")
        text = ""
    else:
        text = readme.read_text(encoding="utf-8")
        for section in REQUIRED_SECTIONS:
            if section not in text:
                ok = False
                errors.append(f"README 缺少关键段落: {section}")
        if "Tokyo V1" not in text:
            ok = False
            errors.append("README 没有回写 Tokyo V1 版本口径")

    git_status = run_git(project_root, "status", "--short")
    git_remote = run_git(project_root, "remote", "-v")

    if not git_remote:
        ok = False
        errors.append("git remote 缺失")

    if args.expect_clean and git_status:
        ok = False
        errors.append("git 工作树不干净")

    payload = {
        "project_root": str(project_root),
        "ok": ok,
        "errors": errors,
        "git_status_short": git_status.splitlines() if git_status else [],
        "has_remote": bool(git_remote),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
