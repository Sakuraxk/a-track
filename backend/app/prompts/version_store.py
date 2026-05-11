"""
Prompt version snapshot storage.
"""
from __future__ import annotations

import difflib
import hashlib
import json
import tomllib
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .registry import PromptContent


@dataclass(frozen=True)
class PromptVersionSummary:
    prompt_name: str
    version_id: str
    created_at: str
    note: str
    restored_from: Optional[str] = None


@dataclass(frozen=True)
class PromptVersionDetail(PromptVersionSummary):
    fixture_data: Optional[Dict[str, Any]] = None
    system_template: Optional[str] = None
    user_template: str = ""
    temperature: float = 0.7
    max_tokens: int = 2000
    output_format: str = "text"


class PromptVersionStore:
    """Persist prompt snapshots and support diff/restore workflows."""

    def __init__(self, prompts_dir: Path):
        self.prompts_dir = Path(prompts_dir)
        self.versions_dir = self.prompts_dir / "versions"
        self.index_path = self.versions_dir / "index.json"

    def create_version(
        self,
        content: PromptContent,
        note: str = "",
        fixture_data: Optional[Dict[str, Any]] = None,
        restored_from: Optional[str] = None,
    ) -> PromptVersionSummary:
        version_id = self._build_version_id(content)
        version_dir = self._version_dir(content.name, version_id)
        version_dir.mkdir(parents=True, exist_ok=True)

        meta = {
            "prompt_name": content.name,
            "version_id": version_id,
            "created_at": datetime.now().isoformat(),
            "note": note,
            "restored_from": restored_from,
            "description": content.description,
            "system_template_path": content.system_template_path,
            "user_template_path": content.user_template_path,
            "temperature": content.temperature,
            "max_tokens": content.max_tokens,
            "output_format": content.output_format,
        }
        (version_dir / "meta.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if content.system_template is not None:
            (version_dir / "system.md").write_text(content.system_template, encoding="utf-8")
        (version_dir / "user.md").write_text(content.user_template, encoding="utf-8")
        (version_dir / "catalog.json").write_text(
            json.dumps(
                {
                    "description": content.description,
                    "system_template": content.system_template_path,
                    "user_template": content.user_template_path,
                    "temperature": content.temperature,
                    "max_tokens": content.max_tokens,
                    "output_format": content.output_format,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        if fixture_data is not None:
            (version_dir / "fixture.json").write_text(
                json.dumps(fixture_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

        index = self._load_index()
        index.setdefault(content.name, [])
        index[content.name].insert(
            0,
            {
                "version_id": version_id,
                "created_at": meta["created_at"],
                "note": note,
                "restored_from": restored_from,
            },
        )
        self._save_index(index)
        return PromptVersionSummary(
            prompt_name=content.name,
            version_id=version_id,
            created_at=meta["created_at"],
            note=note,
            restored_from=restored_from,
        )

    def list_versions(self, prompt_name: str) -> List[PromptVersionSummary]:
        index = self._load_index()
        return [
            PromptVersionSummary(
                prompt_name=prompt_name,
                version_id=item["version_id"],
                created_at=item["created_at"],
                note=item.get("note", ""),
                restored_from=item.get("restored_from"),
            )
            for item in index.get(prompt_name, [])
        ]

    def get_version(self, prompt_name: str, version_id: str) -> PromptVersionDetail:
        version_dir = self._version_dir(prompt_name, version_id)
        meta = json.loads((version_dir / "meta.json").read_text(encoding="utf-8"))
        fixture_path = version_dir / "fixture.json"
        fixture_data = None
        if fixture_path.exists():
            fixture_data = json.loads(fixture_path.read_text(encoding="utf-8"))

        system_template = None
        system_path = version_dir / "system.md"
        if system_path.exists():
            system_template = system_path.read_text(encoding="utf-8")

        return PromptVersionDetail(
            prompt_name=prompt_name,
            version_id=version_id,
            created_at=meta["created_at"],
            note=meta.get("note", ""),
            restored_from=meta.get("restored_from"),
            system_template=system_template,
            user_template=(version_dir / "user.md").read_text(encoding="utf-8"),
            temperature=float(meta["temperature"]),
            max_tokens=int(meta["max_tokens"]),
            output_format=meta["output_format"],
            fixture_data=fixture_data,
        )

    def diff_versions(self, prompt_name: str, old_version_id: str, new_version_id: str) -> Dict[str, str]:
        old_version = self.get_version(prompt_name, old_version_id)
        new_version = self.get_version(prompt_name, new_version_id)
        return {
            "system_template": self._diff_text(old_version.system_template or "", new_version.system_template or ""),
            "user_template": self._diff_text(old_version.user_template, new_version.user_template),
            "catalog": self._diff_text(
                json.dumps(
                    {
                        "temperature": old_version.temperature,
                        "max_tokens": old_version.max_tokens,
                        "output_format": old_version.output_format,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                json.dumps(
                    {
                        "temperature": new_version.temperature,
                        "max_tokens": new_version.max_tokens,
                        "output_format": new_version.output_format,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            ),
        }

    def restore_version(self, prompt_name: str, version_id: str) -> PromptVersionSummary:
        detail = self.get_version(prompt_name, version_id)
        meta = self._load_version_meta(prompt_name, version_id)
        if detail.system_template is not None and meta.get("system_template_path"):
            (self.prompts_dir / meta["system_template_path"]).write_text(detail.system_template, encoding="utf-8")
        (self.prompts_dir / meta["user_template_path"]).write_text(detail.user_template, encoding="utf-8")
        self._update_catalog_entry(prompt_name, meta)

        restored_content = PromptContent(
            name=prompt_name,
            description=meta.get("description", ""),
            system_template_path=meta.get("system_template_path"),
            user_template_path=meta["user_template_path"],
            system_template=detail.system_template,
            user_template=detail.user_template,
            temperature=detail.temperature,
            max_tokens=detail.max_tokens,
            output_format=detail.output_format,
            required_variables=[],
        )
        return self.create_version(
            restored_content,
            note=f"restore {version_id}",
            fixture_data=detail.fixture_data,
            restored_from=version_id,
        )

    def _load_version_meta(self, prompt_name: str, version_id: str) -> Dict[str, Any]:
        version_dir = self._version_dir(prompt_name, version_id)
        return json.loads((version_dir / "meta.json").read_text(encoding="utf-8"))

    def _build_version_id(self, content: PromptContent) -> str:
        timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S-%f")
        digest = hashlib.sha1(
            f"{content.name}|{content.system_template or ''}|{content.user_template}|{content.temperature}|{content.max_tokens}".encode("utf-8")
        ).hexdigest()[:6]
        return f"{timestamp}_{digest}"

    def _version_dir(self, prompt_name: str, version_id: str) -> Path:
        return self.versions_dir / prompt_name / version_id

    def _load_index(self) -> Dict[str, List[Dict[str, Any]]]:
        if not self.index_path.exists():
            return {}
        return json.loads(self.index_path.read_text(encoding="utf-8"))

    def _save_index(self, index: Dict[str, List[Dict[str, Any]]]) -> None:
        self.versions_dir.mkdir(parents=True, exist_ok=True)
        self.index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_catalog_entry(self, prompt_name: str) -> Dict[str, Any]:
        with (self.prompts_dir / "catalog.toml").open("rb") as file:
            raw = tomllib.load(file)
        namespace, key = prompt_name.split(".", 1)
        return raw["prompts"][namespace][key]

    def _update_catalog_entry(self, prompt_name: str, meta: Dict[str, Any]) -> None:
        catalog_path = self.prompts_dir / "catalog.toml"
        with catalog_path.open("rb") as file:
            raw = tomllib.load(file)
        namespace, key = prompt_name.split(".", 1)
        raw["prompts"][namespace][key] = {
            **raw["prompts"][namespace][key],
            "description": meta.get("description", raw["prompts"][namespace][key].get("description", "")),
            "system_template": meta.get("system_template_path"),
            "user_template": meta["user_template_path"],
            "temperature": float(meta["temperature"]),
            "max_tokens": int(meta["max_tokens"]),
            "output_format": meta["output_format"],
        }
        catalog_path.write_text(self._dump_catalog(raw), encoding="utf-8")

    def _dump_catalog(self, raw: Dict[str, Any]) -> str:
        lines: List[str] = []
        for namespace, prompt_entries in raw.get("prompts", {}).items():
            for key, metadata in prompt_entries.items():
                lines.append(f"[prompts.{namespace}.{key}]")
                for field, value in metadata.items():
                    if value is None:
                        continue
                    if isinstance(value, str):
                        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
                        lines.append(f'{field} = "{escaped}"')
                    elif isinstance(value, bool):
                        lines.append(f"{field} = {'true' if value else 'false'}")
                    else:
                        lines.append(f"{field} = {value}")
                lines.append("")
        return "\n".join(lines).rstrip() + "\n"

    def _diff_text(self, old_text: str, new_text: str) -> str:
        diff = difflib.unified_diff(
            old_text.splitlines(),
            new_text.splitlines(),
            fromfile="old",
            tofile="new",
            lineterm="",
        )
        return "\n".join(diff)
