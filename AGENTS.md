# Project instructions

## Delegation

Proactively delegate suitable subtasks in this project when delegation can improve speed, quality, or cost. This is standing authorization to use subagents without a separate request for each task. Keep trivial tasks and tightly dependent steps in the main session.

Run delegated tasks through OpenCode GO using T3 Code's `delegate_task` tool. Set `target.providerInstanceId` to `opencode`. Prefer these models:

| Task | Model | `target.model` |
| --- | --- | --- |
| Simple, bounded tasks where speed matters | GPT-6 Luna | `opencode-go/gpt-6-luna` |
| More complex implementation, reasoning, or review | Muse Spark 1.3 Contributor | `opencode-go/muse-spark-1.3-contributor` |

Check availability and supported options with `orchestrator_capabilities` before launching agents. Use structured tool parameters to select the provider and model. Report availability problems rather than silently switching to another provider.

Give each agent a clear task, relevant context, expected result, and ownership boundaries. Follow T3's orchestration and workspace isolation instructions. The main agent coordinates the work, integrates changes, and verifies the final result.

Preserve the configured security and approval policies when delegating.

## Commit and push completed work

Once the task is complete and all required tests and checks pass, immediately commit the task's changes and push directly to `origin/main`. Do not ask for additional confirmation.

Use a normal, non-force push and preserve unrelated changes.
