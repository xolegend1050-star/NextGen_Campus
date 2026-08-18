# AGENT.md — Collaborative Rules for Hermes & Claude Code

## Project: NextGen_Campus

This document defines the rules of engagement for all AI agents working on this project. Every agent MUST read this file before starting any work.

---

## Roles

### Hermes (Orchestrator)
- Plans features, designs architecture, writes specifications
- Reviews and audits code after implementation
- Runs tests, verifies builds, analyzes logs
- Coordinates task flow and resolves blockers
- Has read access to everything, write access only when Claude is idle

### Claude Code (Builder)
- Implements features from plans written in workload.md
- Writes and refactors code directly in source files
- Creates new files and components
- Runs builds and local dev servers
- Must update workload.md BEFORE and AFTER each task

---

## Rules

### 1. Read Before Write
Every agent MUST read `workload.md` before starting any task. Do NOT begin work on a task already assigned to the other agent.

### 2. Update Before Work
Before starting a task, update `workload.md` with:
- What you are about to do
- Which files you will touch
- Expected outcome

### 3. Update After Work
After completing a task, update `workload.md` with:
- What was done
- Files changed
- Any issues or blockers encountered
- Status: DONE / PARTIAL / BLOCKED

### 4. No Simultaneous Edits
Only ONE agent edits a file at a time. If Claude is coding a file, Hermes stays read-only on that file. Coordinate through workload.md.

### 5. Git Discipline
- Commit after completing a logical unit of work
- Use clear commit messages: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Never leave uncommitted work when handing off to the other agent

### 6. Task Assignment
- Tasks in workload.md have an `assigned_to` field
- Hermes assigns, Claude executes
- Never start a task not assigned to you

### 7. Code Quality
- Follow existing code patterns and conventions in the project
- Add comments for non-obvious logic
- Write meaningful variable/function names
- Don't break existing functionality

### 8. Communication
- Use workload.md as the single source of truth
- No silent changes — if you changed something, log it
- If stuck, mark BLOCKED and explain why

---

## File Ownership

| Area              | Primary Agent | Secondary (Review) |
|-------------------|---------------|---------------------|
| Planning/Design   | Hermes        | Claude              |
| Backend Code      | Claude        | Hermes              |
| Frontend Code     | Claude        | Hermes              |
| AI/ML Service     | Claude        | Hermes              |
| Testing           | Hermes        | Claude              |
| Git Management    | Either        | —                   |
| Debugging         | Hermes        | Claude              |

---

## Workflow

```
Boss assigns task
       ↓
Hermes plans it → writes to workload.md
       ↓
Claude reads workload.md → starts task
       ↓
Claude updates workload.md (IN PROGRESS)
       ↓
Claude codes + commits
       ↓
Claude updates workload.md (DONE)
       ↓
Hermes reviews + tests
       ↓
Hermes updates workload.md (VERIFIED)
       ↓
Report to Boss
```

---

## Emergency

If a critical bug is found:
1. Either agent can fix it immediately
2. Update workload.md with what was fixed
3. Commit with `fix:` prefix
4. Notify the other agent via workload.md
