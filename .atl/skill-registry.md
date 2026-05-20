# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| When implementing a change, preparing commits, splitting PRs, or planning chained/stacked PRs | work-unit-commits | C:\Users\halty\.config\opencode\skills\work-unit-commits\SKILL.md |
| When drafting or posting feedback, review comments, maintainer replies, Slack messages, or GitHub comments | comment-writer | C:\Users\halty\.config\opencode\skills\comment-writer\SKILL.md |
| When writing guides, READMEs, RFCs, onboarding docs, architecture docs, or review-facing documentation | cognitive-doc-design | C:\Users\halty\.config\opencode\skills\cognitive-doc-design\SKILL.md |
| When a PR would exceed 400 changed lines, when planning chained PRs, stacked PRs, or reviewable slices | chained-pr | C:\Users\halty\.config\opencode\skills\chained-pr\SKILL.md |
| When creating a GitHub issue, reporting a bug, or requesting a feature | issue-creation | C:\Users\halty\.config\opencode\skills\issue-creation\SKILL.md |
| When creating a pull request, opening a PR, or preparing changes for review | branch-pr | C:\Users\halty\.config\opencode\skills\branch-pr\SKILL.md |
| When user asks to create a new skill, add agent instructions, or document patterns for AI | skill-creator | C:\Users\halty\.config\opencode\skills\skill-creator\SKILL.md |
| When writing Go tests, using teatest, or adding test coverage | go-testing | C:\Users\halty\.config\opencode\skills\go-testing\SKILL.md |
| When user says "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen" | judgment-day | C:\Users\halty\.config\opencode\skills\judgment-day\SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### work-unit-commits
- Structure commits as deliverable work units, not file-type batches
- Keep tests and docs beside the code they verify
- Each commit should be independently testable and reviewable
- Use conventional commit format with work-unit scope
- Split large changes into multiple work-unit commits

### comment-writer
- Write warm, direct, human comments — not robotic or formal
- Be specific and actionable in feedback
- Match the tone of the conversation (PR review, Slack, issue comment)
- Avoid generic praise; focus on concrete observations

### cognitive-doc-design
- Use progressive disclosure — start simple, add detail on demand
- Chunk information into digestible sections with clear signposts
- Prefer tables, checklists, and recognition over recall
- Structure for scanning, not deep reading

### chained-pr
- Split changes into chained PRs that stay within 400-line review budget
- Each PR should be independently reviewable and mergeable
- Protect reviewer focus — one concern per PR
- Use stack/chain ordering to manage dependencies

### issue-creation
- Follow issue-first enforcement system
- Include clear problem statement, reproduction steps, and expected behavior
- Link to affected code paths and relevant context
- Use labels and templates consistently

### branch-pr
- Follow issue-first enforcement system for PR creation
- Link PR to corresponding issue
- Include summary of changes, testing approach, and screenshots if UI
- Keep PR description focused and reviewable

### skill-creator
- Follow the Agent Skills spec for structure and frontmatter
- Include name, description with trigger, and license in frontmatter
- Write actionable, concise instructions — no fluff
- Test skills by loading them before declaring complete

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| react-hook-form AGENTS.md | .agents\skills\react-hook-form\AGENTS.md | Index — references files below |
