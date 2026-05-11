"""
Prompt registry for loading, validating, and rendering prompt templates.
"""
from __future__ import annotations

import string
import tomllib
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


class PromptRenderError(ValueError):
    """Raised when a prompt cannot be rendered safely."""


@dataclass(frozen=True)
class PromptDefinition:
    """Prompt metadata loaded from the catalog."""

    name: str
    description: str
    system_template: Optional[str]
    user_template: str
    temperature: float
    max_tokens: int
    output_format: str


@dataclass(frozen=True)
class PromptContent:
    """Resolved prompt content plus editable metadata."""

    name: str
    description: str
    system_template_path: Optional[str]
    user_template_path: str
    system_template: Optional[str]
    user_template: str
    temperature: float
    max_tokens: int
    output_format: str
    required_variables: List[str]


class PromptRegistry:
    """Load prompt definitions and render chat messages from templates."""

    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path(__file__).resolve().parent
        self.catalog_path = self.base_dir / "catalog.toml"
        self._formatter = string.Formatter()
        self._definitions = self._load_catalog()

    def get_definition(self, name: str) -> PromptDefinition:
        try:
            return self._definitions[name]
        except KeyError as exc:
            raise KeyError(f"Unknown prompt: {name}") from exc

    def list_definitions(self) -> List[PromptDefinition]:
        return [self._definitions[name] for name in sorted(self._definitions)]

    def get_prompt_content(self, name: str) -> PromptContent:
        definition = self.get_definition(name)
        system_template = None
        if definition.system_template:
            system_template = self._read_template(definition.system_template)

        return PromptContent(
            name=definition.name,
            description=definition.description,
            system_template_path=definition.system_template,
            user_template_path=definition.user_template,
            system_template=system_template,
            user_template=self._read_template(definition.user_template),
            temperature=definition.temperature,
            max_tokens=definition.max_tokens,
            output_format=definition.output_format,
            required_variables=self.get_required_variables(name),
        )

    def get_required_variables(
        self,
        name: str,
        overrides: Optional[Dict[str, Optional[str]]] = None,
    ) -> List[str]:
        definition = self.get_definition(name)
        overrides = overrides or {}
        required: Set[str] = set()

        system_template = overrides.get("system_template")
        if system_template is None and definition.system_template:
            system_template = self._read_template(definition.system_template)
        if system_template:
            required.update(self._extract_fields(system_template))

        user_template = overrides.get("user_template")
        if user_template is None:
            user_template = self._read_template(definition.user_template)
        required.update(self._extract_fields(user_template))
        return sorted(required)

    def render_messages(
        self,
        name: str,
        variables: Optional[Dict[str, Any]] = None,
        overrides: Optional[Dict[str, Optional[str]]] = None,
    ) -> List[Dict[str, str]]:
        definition = self.get_definition(name)
        variables = variables or {}
        overrides = overrides or {}
        messages: List[Dict[str, str]] = []

        system_template = overrides.get("system_template")
        if system_template is None and definition.system_template:
            system_template = self._read_template(definition.system_template)
        if system_template:
            system_content = self._render_template_content(system_template, variables, definition.system_template or "<override>")
            messages.append({"role": "system", "content": system_content})

        user_template = overrides.get("user_template")
        if user_template is None:
            user_template = self._read_template(definition.user_template)
        user_content = self._render_template_content(user_template, variables, definition.user_template)
        messages.append({"role": "user", "content": user_content})
        return messages

    def _load_catalog(self) -> Dict[str, PromptDefinition]:
        with self.catalog_path.open("rb") as file:
            raw = tomllib.load(file)

        prompts = raw.get("prompts", {})
        definitions: Dict[str, PromptDefinition] = {}
        for namespace, prompt_entries in prompts.items():
            for key, metadata in prompt_entries.items():
                name = f"{namespace}.{key}"
                definitions[name] = PromptDefinition(
                    name=name,
                    description=metadata.get("description", ""),
                    system_template=metadata.get("system_template"),
                    user_template=metadata["user_template"],
                    temperature=float(metadata.get("temperature", 0.7)),
                    max_tokens=int(metadata.get("max_tokens", 2000)),
                    output_format=metadata.get("output_format", "text"),
                )
        return definitions

    def _read_template(self, relative_path: str) -> str:
        template_path = self.base_dir / relative_path
        return template_path.read_text(encoding="utf-8")

    def _render_template(self, relative_path: str, variables: Dict[str, Any]) -> str:
        template = self._read_template(relative_path)
        return self._render_template_content(template, variables, relative_path)

    def _render_template_content(self, template: str, variables: Dict[str, Any], source_name: str) -> str:
        required_fields = self._extract_fields(template)
        missing = sorted(field for field in required_fields if field not in variables)
        if missing:
            missing_text = ", ".join(missing)
            raise PromptRenderError(
                f"Missing required prompt variables for {source_name}: {missing_text}"
            )
        rendered = template.format(**variables)
        return rendered.strip()

    def _extract_fields(self, template: str) -> Set[str]:
        fields: Set[str] = set()
        for _, field_name, _, _ in self._formatter.parse(template):
            if field_name:
                fields.add(field_name)
        return fields


@lru_cache
def get_prompt_registry() -> PromptRegistry:
    """Return the cached prompt registry."""
    return PromptRegistry()
