# VoicePandita AI Development Lifecycle

VoicePandita uses a lightweight, spec-driven AI development lifecycle inspired by AGENTS.md specs, PRD workflows, memory-bank documentation, and responsible AI review gates. This is not a vendor framework; it is a project-specific AI-DLC process designed for a hackathon MVP with real AI, data, and inclusion risks.

## Framework Adopted

```text
VoicePandita AGENTS.md Spec + Memory Bank Workflow
```

Use this as the "other AI-DLC framework" name in forms if the predefined choices do not match.

## Why We Use It

VoicePandita mixes multiple AI surfaces:

- Gemini/Groq tutor answers.
- Groq Whisper transcription.
- Gemini OCR.
- Supabase pgvector retrieval.
- Neo4j graph memory.
- Chakma/Marma/Garo language routing.
- BdSL accessibility work.
- Local Qwen2.5 LoRA/QLoRA research on `my-feature`.

Because of that, every feature needs provenance, fallback behavior, privacy review, and clear separation between implemented and planned claims.

## Lifecycle Phases

### 1. Spec

Artifacts:

- User story.
- Target learner group.
- Route/API touched.
- Data touched.
- Acceptance criteria.
- Implemented vs planned label.

Gate:

- The feature must have a clear learner value and a measurable demo path.

### 2. Design

Artifacts:

- System boundary notes.
- Model/provider choice.
- Dataset provenance.
- Environment variables.
- Failure fallback.
- Privacy/safety risks.

Gate:

- The design must avoid exposing service-role keys, raw private student data, or unsupported model claims.

### 3. Implement

Artifacts:

- Code in the smallest matching area:
  - `src/app` for routes/pages.
  - `src/components` for UI.
  - `src/lib` for reusable logic.
  - `scripts` and `supabase` for data setup.
  - `ml` and `data` for multilingual model pipeline.

Gate:

- AI/network failures must degrade gracefully with safe fallbacks.

### 4. Evaluate

Artifacts:

- Test result or manual verification note.
- Representative input/output samples.
- Known limitations.

Gate:

- Core learner path should still work:
  - auth/demo login
  - ask question
  - answer appears
  - diagram/animation appears when expected
  - fallback works when provider is missing

### 5. Document

Artifacts:

- README update for user-facing features.
- Data/model provenance note.
- Branch-specific notes for unmerged work.

Gate:

- The report must not say a roadmap item is already shipped.

### 6. Review

Artifacts:

- Checklist from `AGENTS.md`.
- Security/privacy scan.
- Claim hygiene scan.

Gate:

- No secrets, unsupported claims, or unsafe low-resource language generation.

## Current AI-DLC Artifacts In This Repo

```text
AGENTS.md
docs/AI_DLC.md
README.md
supabase/schema.sql
scripts/create_vector_search_function.sql
scripts/create_pwn_questions.sql
scripts/neo4j_constraints.cypher
scripts/seed_curriculum.py
ml/multilingual_data.py
ml/finetune_lora.py
ml/inference.py
data/*.jsonl
tests/smoke.spec.ts
```

## Process Notes For BuildFest Form

Short version:

```text
We adopted a custom VoicePandita AGENTS.md Spec + Memory Bank workflow. Product, architecture, AI, data, frontend, and QA responsibilities are documented in AGENTS.md. Each AI feature goes through spec, design, implementation, evaluation, documentation, and review gates. The memory bank lives in README.md, docs/AI_DLC.md, SQL setup scripts, ML scripts, and dataset JSONL files. Review gates check data/model provenance, privacy, fallback behavior, and whether claims are implemented, branch-specific, prototype, or roadmap.
```

Long version:

```text
VoicePandita follows a project-specific AI-DLC called "AGENTS.md Spec + Memory Bank". We use AGENTS.md to define agent roles: Product, Architecture, AI, Data, Frontend, and QA. Each feature starts with a short spec, then design notes for model/provider choice, data provenance, env vars, failure fallbacks, and privacy risks. Implementation is scoped to existing Next.js, Supabase, Neo4j, Python helper, or ML pipeline modules. Evaluation covers route smoke tests or manual demo-path checks. Documentation updates README.md and docs/AI_DLC.md, with strict claim hygiene separating main-branch implementation, my-feature branch work, prototypes, and roadmap. Review gates check secrets, student privacy, low-resource language safety, and whether AI providers degrade safely.
```

## Claim Labels

Use these labels in docs and submissions:

| Label | Meaning |
| --- | --- |
| Implemented in main | Present and wired in the current production branch. |
| Implemented in my-feature | Present in the ethnic-language research branch. |
| Prototype/demo | Visible but not production complete. |
| Planned | Roadmap only. |

## Responsible AI Gates

- Data provenance documented.
- Model/provider documented.
- Fallback documented.
- User privacy reviewed.
- Low-resource language safety reviewed.
- Claims checked against code.
- Tests or manual verification recorded.
