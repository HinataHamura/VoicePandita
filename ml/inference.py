#!/usr/bin/env python3
"""
Text-only inference helpers for VoicePandita.

Exports:
- detect_input_language(text)
- generate_answer(user_text, selected_target_language, subject_context=None)
"""

from __future__ import annotations

import argparse
import json
import os
import re
from functools import lru_cache
from typing import Any

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


SYSTEM_PROMPT = """You are a multilingual educational assistant.
You can understand Bangla, English, Chakma, Garo, and Marma.
Always answer in the selected target language.
The selected target language has higher priority than the input language.
Explain educational topics simply for students.
Do not switch language unless the selected target language changes.
Do not invent fake Chakma, Garo, or Marma words.
If verified data is not enough, give a safe fallback response."""

VALID_TARGETS = {"Bangla", "Chakma", "Garo", "Marma"}
TARGET_ALIASES = {
    "bn": "Bangla",
    "bangla": "Bangla",
    "bengali": "Bangla",
    "ccp": "Chakma",
    "ckm": "Chakma",
    "chakma": "Chakma",
    "garo": "Garo",
    "gnk": "Garo",
    "grt": "Garo",
    "mrm": "Marma",
    "marma": "Marma",
}
GARO_HINTS = {"ang", "na", "ara", "aro", "dak", "gita", "ia", "mande", "nang", "ona", "rang"}


def normalize_target_language(value: str) -> str:
    return TARGET_ALIASES.get(str(value).strip().lower(), "Bangla")


def detect_input_language(text: str) -> str:
    value = (text or "").strip()
    if not value:
        return "unknown"
    if any(0x11100 <= ord(char) <= 0x1114F for char in value):
        return "Chakma"
    if any(0x1000 <= ord(char) <= 0x109F for char in value):
        return "Marma"
    if any(0x0980 <= ord(char) <= 0x09FF for char in value):
        return "Bangla"
    words = re.findall(r"[A-Za-z]+", value.lower())
    if words:
        if sum(1 for word in words if word in GARO_HINTS) >= 2:
            return "Garo"
        return "English"
    return "unknown"


def safe_fallback(target_language: str) -> str:
    return (
        f"Verified {target_language} translation data is not available enough for this answer yet. "
        f"Please add verified {target_language} educational examples or run the fine-tuned multilingual model "
        f"before enabling {target_language} answers."
    )


@lru_cache(maxsize=1)
def load_model() -> tuple[Any, Any] | None:
    base_model = os.environ.get("VP_BASE_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
    adapter_path = os.environ.get("VP_LORA_ADAPTER", "models/voicepandita-multilingual-lora")
    if not os.path.exists(adapter_path):
        return None

    tokenizer = AutoTokenizer.from_pretrained(adapter_path, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        device_map="auto",
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(model, adapter_path)
    model.eval()
    return tokenizer, model


def build_prompt(tokenizer: Any, payload: dict[str, Any]) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Instruction: Answer the student's question in the selected target language.\n"
                f"Input: {json.dumps(payload, ensure_ascii=False, sort_keys=True)}"
            ),
        },
    ]
    if hasattr(tokenizer, "apply_chat_template"):
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    return f"<|system|>\n{SYSTEM_PROMPT}\n<|user|>\n{messages[1]['content']}\n<|assistant|>\n"


def generate_answer(user_text: str, selected_target_language: str, subject_context: str | None = None) -> str:
    target_language = normalize_target_language(selected_target_language)
    input_language = detect_input_language(user_text)
    payload = {
        "user_text": user_text,
        "input_language": input_language,
        "target_language": target_language,
        "subject_context": subject_context or "",
    }

    loaded = load_model()
    if loaded is None:
        if target_language == "Bangla":
            return "মডেল অ্যাডাপ্টার পাওয়া যায়নি। Bangla উত্তর দিতে `VP_LORA_ADAPTER` সেট করে fine-tuned model চালাও।"
        return safe_fallback(target_language)

    tokenizer, model = loaded
    prompt = build_prompt(tokenizer, payload)
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=256,
            do_sample=False,
            temperature=0.0,
            pad_token_id=tokenizer.eos_token_id,
        )
    generated = tokenizer.decode(output_ids[0][inputs["input_ids"].shape[-1] :], skip_special_tokens=True)
    return generated.strip() or safe_fallback(target_language)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("question")
    parser.add_argument("--target-language", default="Bangla")
    parser.add_argument("--subject-context", default=None)
    args = parser.parse_args()
    print(generate_answer(args.question, args.target_language, args.subject_context))


if __name__ == "__main__":
    main()
