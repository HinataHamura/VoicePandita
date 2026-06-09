# VoicePandita Agent Spec

This file defines the AI development lifecycle rules for agents working on VoicePandita. It is intentionally lightweight so it can be followed by Codex, Cursor, Cline, Windsurf, Kiro-style spec agents, or human reviewers.

## Product Mission

VoicePandita is a Bangladesh-first AI tutor for underserved learners. Every change should protect these goals:

- Bangla-first learning.
- Rural and low-connectivity usability.
- Indigenous language inclusion for Chakma, Marma, and Garo.
- Deaf learner accessibility through BdSL work.
- Curriculum-grounded answers instead of confident hallucination.
- Privacy-first handling of student data.

## Agent Roles

### Product Agent

- Defines learner problem, target user, expected behavior, and acceptance criteria.
- Keeps implemented, branch-specific, and planned claims separate.
- Checks that hackathon/report claims match the codebase.

### Architecture Agent

- Owns system boundaries across Next.js, Supabase, Neo4j, local Python helpers, and AI providers.
- Reviews API route contracts, environment variables, and failure behavior.
- Prevents secrets from being exposed client-side.

### AI Agent

- Owns tutor prompts, RAG context, fallback behavior, model selection, and multilingual safety rules.
- Must not claim unsupported native-language fluency.
- Must prefer verified datasets and safe fallback over invented Chakma, Marma, or Garo words.

### Frontend Agent

- Owns learning UX, accessibility, responsive UI, diagrams, animations, and BdSL presentation.
- Keeps main learning flows usable on low-end devices and weak networks.

### Data Agent

- Owns Supabase schema, pgvector functions, PWN data, curriculum chunks, dataset provenance, and retention notes.
- Distinguishes local demo data from full production datasets.

### QA Agent

- Owns smoke tests, route checks, regression notes, and demo script verification.
- Updates tests when routes or onboarding steps change.

## Development Phases

1. **Spec**
   - Write the user goal, route/API impact, data impact, and acceptance criteria.
   - Identify whether the work is main branch, branch-specific, or roadmap.

2. **Design**
   - Decide frontend/backend/data/model boundaries.
   - List env vars, external services, and fallbacks.
   - Note privacy and safety risks.

3. **Implement**
   - Keep changes scoped.
   - Use existing patterns in `src/app`, `src/components`, `src/lib`, `scripts`, and `supabase`.
   - Add deterministic fallbacks for AI/network failures.

4. **Evaluate**
   - Run relevant tests or document why they were not run.
   - Check representative flows:
     - login/demo -> learn -> ask -> answer/diagram
     - language mode -> selected target language
     - PWN storage/fetch
     - OCR/STT fallback
     - offline fallback

5. **Document**
   - Update README or docs when behavior changes.
   - Document implemented vs planned honestly.
   - Include data/model provenance for any AI feature.

6. **Review Gate**
   - Verify no real secrets are committed.
   - Verify student data is not unnecessarily exposed.
   - Verify low-resource language output does not invent unsupported terms.
   - Verify claims match code.

## Memory Bank

Agents should preserve durable project memory in docs, not in chat-only context.

- `README.md`: public project summary and setup.
- `docs/AI_DLC.md`: AI development lifecycle process.
- `docs/MCP.md`: MCP server usage and architecture.
- `AGENTS.md`: agent operating rules.
- `supabase/*.sql` and `scripts/*.sql`: database memory.
- `ml/*.py` and `data/*.jsonl`: multilingual model/data pipeline memory.

## Claim Hygiene Rules

Use these labels in reports:

- **Implemented in main**: present in the current branch and wired into the app.
- **Implemented in my-feature**: present in the ethnic-language branch, not necessarily merged.
- **Prototype/demo**: visible but not production-complete.
- **Planned**: not yet implemented.

Do not describe planned or branch-only work as shipped production behavior.

## AI Safety Rules

- Ground school answers in available curriculum context where possible.
- Use fallback answers when model providers fail.
- For Chakma, Marma, and Garo, prefer verified examples and safe fallback over invented language.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, Neo4j credentials, and AI provider keys server-side.
- Do not store raw audio longer than necessary.
- Treat anonymous question vectors as privacy-sensitive.

## Review Checklist

- [ ] Feature behavior is described in README/docs if user-facing.
- [ ] API route request/response behavior is clear.
- [ ] Environment variables are documented.
- [ ] External datasets/models are named with provenance.
- [ ] Failure fallback exists.
- [ ] Tests or manual verification are recorded.
- [ ] No secrets or private data are introduced.
