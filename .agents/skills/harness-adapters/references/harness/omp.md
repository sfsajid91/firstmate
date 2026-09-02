# Oh My Pi (OMP)

Verified on 2026-09-01 with OMP 18.0.11 unless a fact gives another version.

## Operating facts

| Fact | Value |
|---|---|
| Busy state | The Firstmate-owned extension's `agent_start` marks busy and `agent_settled`, confirmed by `ctx.isIdle()`, marks idle; this covers retries, compaction, tool loops, and queued continuations. |
| Exit command | `/exit`. |
| Interrupt | Single Escape. |
| Skill invocation | No separate verified form beyond normal command behavior; use natural language when the exact command is uncertain. |
| Model flag | `--model <model>`. |
| Effort flag | `--thinking <low\|medium\|high\|xhigh\|max>`; OMP accepts the shared effort levels through `--thinking`. |
| Autonomy | `--approval-mode yolo` runs autonomous workers without approval gates. |

OMP does not advertise Pi's `--tui-mode` flag, so Firstmate omits it.
`../../../bin/fm-spawn.sh --help` owns the executable-pinning and launch mechanics.

Keep the instructions as one positional argument.
The spawn template already preserves the one-argument shape.

## Worker turn-end extension

`../../../bin/fm-spawn.sh` keeps the worker turn-end extension in `state/`, outside the worktree.
The extension listens for `agent_start`, `agent_settled` plus `ctx.isIdle()`, and `turn_end`.
Firstmate launches OMP with `FM_OMP_HARNESS=omp` as its harness-detection marker.

## Primary integration

OMP primary supervision reuses Pi extension logic through four thin re-export wrappers in `.omp/extensions/`:
- `.omp/extensions/fm-primary-pi-watch.ts`
- `.omp/extensions/fm-primary-turnend-guard.ts`
- `.omp/extensions/fm-calm.ts`
- `.omp/extensions/fm-branch-supervision.ts`

OMP auto-discovers tracked project-local extensions in `.omp/extensions/` natively.
The model arms through the `fm_watch_arm_pi` tool, never through a foreground shell arm.
The tool result and clean-exit fallback are owned by `../../../docs/supervision-protocols/omp.md`.
`../../../bin/fm-session-start.sh` reports when the live OMP session has not loaded both required extensions and points at restart with `-e` as a fallback.

When a secondmate is launched on OMP, `../../../bin/fm-spawn.sh --secondmate` launches the resolved `omp` executable with both `-e .omp/extensions/fm-primary-turnend-guard.ts` and `-e .omp/extensions/fm-primary-pi-watch.ts`.
Both files exist in the secondmate home's git worktree.
