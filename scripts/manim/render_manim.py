#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCENE_FILE = ROOT / "scripts" / "manim" / "voicepandita_scenes.py"
MANIFEST = ROOT / "public" / "animations" / "manim" / "manifest.json"
VIDEO_DIR = ROOT / "public" / "animations" / "manim" / "videos"
MEDIA_DIR = ROOT / ".manim-cache"
SCENE_CLASSES = {
    "newton_second_law": "NewtonSecondLawScene",
    "quadratic_formula": "QuadraticFormulaScene",
    "photosynthesis": "PhotosynthesisScene",
}


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def save_manifest(manifest: dict) -> None:
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_manifest(key: str, output_name: str) -> None:
    manifest = load_manifest()
    for asset in manifest.get("assets", []):
        if asset.get("key") == key:
            asset["src"] = f"/animations/manim/videos/{output_name}"
            asset["available"] = True
            asset["generatedAt"] = datetime.now(timezone.utc).isoformat()
            break
    else:
        raise SystemExit(f"No manifest asset for key: {key}")
    save_manifest(manifest)


QUALITY_FLAGS = {
    "low": "-ql",
    "medium": "-qm",
    "high": "-qh",
}


def render_scene(key: str, quality: str) -> Path:
    try:
        has_manim = importlib.util.find_spec("manim") is not None
    except ModuleNotFoundError as exc:
        has_manim = False
        missing_error = exc
    else:
        missing_error = None

    if not has_manim:
        raise SystemExit(
            "Manim is not installed. Run: pip install -r requirements-manim.txt"
        ) from missing_error

    scene_class = SCENE_CLASSES[key]
    output_name = f"{key}.mp4"
    command = [
        sys.executable,
        "-m",
        "manim",
        str(SCENE_FILE),
        scene_class,
        QUALITY_FLAGS[quality],
        "--media_dir",
        str(MEDIA_DIR),
        "--format",
        "mp4",
        "-o",
        output_name,
    ]
    subprocess.run(command, cwd=str(ROOT), check=True)

    rendered = next(MEDIA_DIR.rglob(output_name), None)
    if not rendered:
        raise SystemExit(f"Rendered video not found for {key}")

    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    destination = VIDEO_DIR / output_name
    shutil.copy2(rendered, destination)
    update_manifest(key, output_name)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description="Render curated VoicePandita Manim explainers.")
    parser.add_argument("--key", choices=[*SCENE_CLASSES.keys(), "all"], default="all")
    parser.add_argument("--quality", choices=QUALITY_FLAGS.keys(), default="low")
    parser.add_argument("--list", action="store_true", help="List renderable animation keys.")
    args = parser.parse_args()

    if args.list:
        for key in SCENE_CLASSES:
            print(key)
        return

    keys = list(SCENE_CLASSES.keys()) if args.key == "all" else [args.key]
    for key in keys:
        destination = render_scene(key, args.quality)
        print(f"Rendered {key}: {destination.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
