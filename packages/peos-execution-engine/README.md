# @nexora/peos-execution-engine v0.1.0

Executable implementation of the PEOS/NEXORA Execution Loop Protocol.

## Purpose

Turn the operational directive into a deterministic state machine with:

- explicit states and allowed transitions;
- validation gates;
- mandatory evidence records;
- real-blocker handling;
- correction/retest loops;
- integration evidence contracts for GitHub, Neon and Atlassian.

## Core loop

`EXECUTE -> VERIFY -> TEST -> CORRECT -> RETEST -> REVIEW -> VALIDATE -> EVIDENCE -> APPROVE -> NEXT`

A failed test is not a blocker. It routes to `CORRECTING` and then `RETESTING`.
A real blocker is explicitly classified and moves the execution to `BLOCKED`.

## Integration contract

### GitHub

Responsible for code and delivery evidence. Expected evidence types:

`branch`, `commit_or_diff`, `tests`, `ci`, `review`

Operational commands/tools should establish and verify a working branch, implementation diff, automated tests, CI result and review before approval.

### Neon

Responsible for PostgreSQL schema/data evidence. Expected evidence types:

`branch`, `migration`, `schema_check`, `data_check`, `tests`

Schema changes should be validated in an isolated branch where practical, with migration and effective schema/data verification recorded.

### Atlassian

Responsible for work tracking and governance evidence. Expected evidence types:

`issue`, `acceptance_criteria`, `blockers`, `validation`, `status_update`

The work item is the traceability anchor for objective, acceptance criteria, blockers and final status.

## Example

```js
import {
  createExecution,
  move,
  addCheck,
  addTest,
  markCriterion,
  addEvidence,
  approve,
} from '@nexora/peos-execution-engine';

const execution = createExecution({
  executionId: 'exec-001',
  taskId: 'NEXORA-001',
  objective: 'Validate a delivery step',
  criteria: ['The delivery passes validation'],
});

move(execution, 'PLANNING');
move(execution, 'EXECUTING');
move(execution, 'VERIFYING');
addCheck(execution, { name: 'result', status: 'PASS', reference: 'check-001' });
move(execution, 'TESTING');
addTest(execution, { name: 'integration', status: 'PASS', reference: 'test-001' });
move(execution, 'REVIEWING');
move(execution, 'VALIDATING');
markCriterion(execution, 'AC-1', 'PASS');
move(execution, 'EVIDENCING');
addEvidence(execution, { type: 'tests', reference: 'test-001' });
approve(execution);
```

## Test

```bash
pnpm --filter @nexora/peos-execution-engine test
```

The engine is intentionally dependency-light in v0.1. Integration adapters can be added without changing the core state machine.
