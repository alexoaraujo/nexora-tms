export const PROTOCOL_VERSION = 'PEOS-EXECUTION-LOOP-v1';

export const STATES = Object.freeze([
  'PENDING',
  'PLANNING',
  'EXECUTING',
  'VERIFYING',
  'TESTING',
  'CORRECTING',
  'RETESTING',
  'REVIEWING',
  'VALIDATING',
  'EVIDENCING',
  'APPROVED',
  'NEXT',
  'BLOCKED',
]);

const TRANSITIONS = new Map([
  ['PENDING', ['PLANNING']],
  ['PLANNING', ['EXECUTING', 'BLOCKED']],
  ['EXECUTING', ['VERIFYING', 'BLOCKED']],
  ['VERIFYING', ['TESTING', 'CORRECTING', 'BLOCKED']],
  ['TESTING', ['REVIEWING', 'CORRECTING', 'BLOCKED']],
  ['CORRECTING', ['RETESTING', 'BLOCKED']],
  ['RETESTING', ['REVIEWING', 'CORRECTING', 'BLOCKED']],
  ['REVIEWING', ['VALIDATING', 'CORRECTING', 'BLOCKED']],
  ['VALIDATING', ['EVIDENCING', 'CORRECTING', 'BLOCKED']],
  ['EVIDENCING', ['APPROVED', 'VERIFYING', 'BLOCKED']],
  ['APPROVED', ['NEXT']],
  ['NEXT', ['PLANNING']],
  ['BLOCKED', ['VERIFYING', 'PLANNING', 'EXECUTING']],
]);

export const BLOCKER_CATEGORIES = Object.freeze([
  'BLOCK-01_ACCESS',
  'BLOCK-02_EXTERNAL_DEPENDENCY',
  'BLOCK-03_MISSING_INFORMATION',
  'BLOCK-04_CRITICAL_RISK',
  'BLOCK-05_CONTRADICTORY_REQUIREMENTS',
  'BLOCK-06_AUTHORITY_LIMIT',
]);

export function canTransition(from, to) {
  return TRANSITIONS.get(from)?.includes(to) ?? false;
}

export function transition(state, to) {
  if (!canTransition(state, to)) {
    throw new Error(`Invalid PEOS transition: ${state} -> ${to}`);
  }
  return to;
}

export function createExecution({ executionId, taskId, objective, criteria = [] }) {
  if (!executionId || !taskId || !objective) {
    throw new Error('executionId, taskId and objective are required');
  }

  return {
    protocol: PROTOCOL_VERSION,
    executionId,
    taskId,
    objective,
    state: 'PENDING',
    acceptanceCriteria: criteria.map((description, index) => ({
      id: `AC-${index + 1}`,
      description,
      status: 'PENDING',
    })),
    checks: [],
    tests: [],
    corrections: [],
    evidence: [],
    blockers: [],
    history: [{ from: null, to: 'PENDING', at: new Date().toISOString() }],
  };
}

export function move(execution, to, reason = '') {
  const from = execution.state;
  execution.state = transition(from, to);
  execution.history.push({ from, to, reason, at: new Date().toISOString() });
  return execution;
}

export function addCheck(execution, { name, status, reference }) {
  execution.checks.push({ name, status, reference, at: new Date().toISOString() });
  return execution;
}

export function addTest(execution, { name, status, reference }) {
  execution.tests.push({ name, status, reference, at: new Date().toISOString() });
  return execution;
}

export function addCorrection(execution, { problem, action, status = 'APPLIED', reference }) {
  execution.corrections.push({ problem, action, status, reference, at: new Date().toISOString() });
  return execution;
}

export function addEvidence(execution, { type, reference, description }) {
  if (!type || !reference) throw new Error('Evidence type and reference are required');
  execution.evidence.push({ type, reference, description: description ?? '', at: new Date().toISOString() });
  return execution;
}

export function addBlocker(execution, { category, description, impact, requiredAction, evidence = [] }) {
  if (!BLOCKER_CATEGORIES.includes(category)) throw new Error(`Invalid blocker category: ${category}`);
  const blocker = {
    id: `BLOCK-${execution.blockers.length + 1}`,
    category,
    description,
    impact,
    requiredAction,
    evidence,
    status: 'OPEN',
    at: new Date().toISOString(),
  };
  execution.blockers.push(blocker);
  execution.state = 'BLOCKED';
  execution.history.push({ from: execution.state, to: 'BLOCKED', reason: blocker.id, at: new Date().toISOString() });
  return execution;
}

export function isApproved(execution) {
  const checksPass = execution.checks.length > 0 && execution.checks.every((x) => x.status === 'PASS');
  const testsPass = execution.tests.length > 0 && execution.tests.every((x) => x.status === 'PASS');
  const criteriaPass = execution.acceptanceCriteria.every((x) => x.status === 'PASS');
  const noOpenBlockers = execution.blockers.every((x) => x.status !== 'OPEN');
  const evidenceComplete = execution.evidence.length > 0;

  return checksPass && testsPass && criteriaPass && noOpenBlockers && evidenceComplete;
}

export function approve(execution) {
  if (!isApproved(execution)) {
    throw new Error('Validation gate failed: execution is not eligible for APPROVED');
  }
  return move(execution, 'APPROVED', 'All validation gates passed');
}

export function markCriterion(execution, id, status) {
  const criterion = execution.acceptanceCriteria.find((x) => x.id === id);
  if (!criterion) throw new Error(`Unknown acceptance criterion: ${id}`);
  if (!['PASS', 'FAIL', 'PENDING'].includes(status)) throw new Error(`Invalid criterion status: ${status}`);
  criterion.status = status;
  return execution;
}

export function resolveBlocker(execution, blockerId, evidence = []) {
  const blocker = execution.blockers.find((x) => x.id === blockerId);
  if (!blocker) throw new Error(`Unknown blocker: ${blockerId}`);
  blocker.status = 'RESOLVED';
  blocker.resolutionEvidence = evidence;
  return execution;
}

export const integrationContracts = Object.freeze({
  github: {
    responsibility: 'code, branches, commits, pull requests and CI evidence',
    requiredEvidence: ['branch', 'commit_or_diff', 'tests', 'ci', 'review'],
  },
  neon: {
    responsibility: 'PostgreSQL schema, migrations, isolated branches and database validation',
    requiredEvidence: ['branch', 'migration', 'schema_check', 'data_check', 'tests'],
  },
  atlassian: {
    responsibility: 'requirements, acceptance criteria, dependencies, blockers and status',
    requiredEvidence: ['issue', 'acceptance_criteria', 'blockers', 'validation', 'status_update'],
  },
});

export function validateIntegrationEvidence(execution, system) {
  const contract = integrationContracts[system];
  if (!contract) throw new Error(`Unknown integration: ${system}`);
  const present = new Set(execution.evidence.map((x) => x.type));
  return contract.requiredEvidence.every((required) => present.has(required));
}

export function nextAction(execution) {
  if (execution.state === 'BLOCKED') return 'RESOLVE_BLOCKER';
  if (['PENDING'].includes(execution.state)) return 'PLAN';
  if (['PLANNING'].includes(execution.state)) return 'EXECUTE';
  if (['EXECUTING'].includes(execution.state)) return 'VERIFY';
  if (['VERIFYING'].includes(execution.state)) return execution.checks.some((x) => x.status === 'FAIL') ? 'CORRECT' : 'TEST';
  if (['TESTING', 'RETESTING'].includes(execution.state)) return execution.tests.some((x) => x.status === 'FAIL') ? 'CORRECT' : 'REVIEW';
  if (execution.state === 'CORRECTING') return 'RETEST';
  if (execution.state === 'REVIEWING') return 'VALIDATE';
  if (execution.state === 'VALIDATING') return 'EVIDENCE';
  if (execution.state === 'EVIDENCING') return isApproved(execution) ? 'APPROVE' : 'VERIFY';
  if (execution.state === 'APPROVED') return 'NEXT';
  if (execution.state === 'NEXT') return 'PLAN';
  return 'STOP';
}
