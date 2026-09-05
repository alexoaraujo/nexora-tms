import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBlocker,
  addCheck,
  addEvidence,
  addTest,
  approve,
  createExecution,
  isApproved,
  markCriterion,
  move,
  nextAction,
  resolveBlocker,
} from '../src/index.mjs';

test('follows the happy-path state machine and approves only with evidence', () => {
  const execution = createExecution({
    executionId: 'exec-001',
    taskId: 'task-001',
    objective: 'Validate PEOS execution loop',
    criteria: ['State transitions are enforced'],
  });

  move(execution, 'PLANNING');
  move(execution, 'EXECUTING');
  move(execution, 'VERIFYING');
  addCheck(execution, { name: 'result', status: 'PASS', reference: 'check-001' });
  move(execution, 'TESTING');
  addTest(execution, { name: 'state machine', status: 'PASS', reference: 'test-001' });
  move(execution, 'REVIEWING');
  move(execution, 'VALIDATING');
  markCriterion(execution, 'AC-1', 'PASS');
  move(execution, 'EVIDENCING');

  assert.equal(isApproved(execution), false);
  addEvidence(execution, { type: 'tests', reference: 'test-001' });
  assert.equal(isApproved(execution), true);
  approve(execution);
  assert.equal(execution.state, 'APPROVED');
  assert.equal(nextAction(execution), 'NEXT');
});

test('rejects invalid state transitions', () => {
  const execution = createExecution({ executionId: 'exec-002', taskId: 'task-002', objective: 'x' });
  assert.throws(() => move(execution, 'APPROVED'), /Invalid PEOS transition/);
});

test('requires correction after a failed test', () => {
  const execution = createExecution({ executionId: 'exec-003', taskId: 'task-003', objective: 'x' });
  move(execution, 'PLANNING');
  move(execution, 'EXECUTING');
  move(execution, 'VERIFYING');
  addCheck(execution, { name: 'result', status: 'PASS', reference: 'check-003' });
  move(execution, 'TESTING');
  addTest(execution, { name: 'integration', status: 'FAIL', reference: 'test-003' });
  assert.equal(nextAction(execution), 'CORRECT');
  move(execution, 'CORRECTING');
  move(execution, 'RETESTING');
  addTest(execution, { name: 'integration-retest', status: 'PASS', reference: 'test-004' });
  assert.equal(nextAction(execution), 'REVIEW');
});

test('blocks only with an explicit real blocker and resumes after resolution', () => {
  const execution = createExecution({ executionId: 'exec-004', taskId: 'task-004', objective: 'x' });
  move(execution, 'PLANNING');
  addBlocker(execution, {
    category: 'BLOCK-01_ACCESS',
    description: 'Required environment is unavailable',
    impact: 'Cannot execute validation',
    requiredAction: 'Restore authorized access',
    evidence: ['access-check-004'],
  });

  assert.equal(execution.state, 'BLOCKED');
  assert.equal(nextAction(execution), 'RESOLVE_BLOCKER');
  resolveBlocker(execution, 'BLOCK-1', ['access-restored-004']);
  move(execution, 'EXECUTING');
  assert.equal(execution.state, 'EXECUTING');
});
