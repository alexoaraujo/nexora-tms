export const INTEGRATION_OPERATIONS = Object.freeze({
  github: {
    inspect: 'Inspect repository, branch, diff, PR and CI status',
    execute: 'Create/update implementation on an isolated branch',
    validate: 'Require tests + CI + review evidence before approval',
    evidence: ['branch', 'commit_or_diff', 'tests', 'ci', 'review'],
  },
  neon: {
    inspect: 'Inspect project/branch/schema state',
    execute: 'Apply controlled migration on an isolated database branch',
    validate: 'Verify migration, schema, data and database tests',
    evidence: ['branch', 'migration', 'schema_check', 'data_check', 'tests'],
  },
  atlassian: {
    inspect: 'Inspect issue, acceptance criteria, dependencies and blockers',
    execute: 'Create/update tracked work and record execution evidence',
    validate: 'Require acceptance criteria, blocker status and validation evidence',
    evidence: ['issue', 'acceptance_criteria', 'blockers', 'validation', 'status_update'],
  },
});

export const COMMANDS = Object.freeze({
  github: Object.freeze([
    'inspect repository',
    'inspect branch',
    'inspect diff',
    'run tests',
    'inspect CI',
    'inspect PR/review',
  ]),
  neon: Object.freeze([
    'inspect project',
    'inspect branch',
    'inspect migration',
    'verify schema',
    'verify data',
    'run database tests',
  ]),
  atlassian: Object.freeze([
    'inspect issue',
    'inspect acceptance criteria',
    'inspect dependencies',
    'register blocker',
    'record validation',
    'update status',
  ]),
});

export function getIntegrationOperation(system, operation) {
  const contract = INTEGRATION_OPERATIONS[system];
  if (!contract) throw new Error(`Unknown integration: ${system}`);
  if (!['inspect', 'execute', 'validate'].includes(operation)) {
    throw new Error(`Unknown integration operation: ${operation}`);
  }
  return { system, operation, description: contract[operation], evidence: contract.evidence };
}

export function getCommandPlan(system) {
  if (!COMMANDS[system]) throw new Error(`Unknown integration: ${system}`);
  return [...COMMANDS[system]];
}
