import { pathToFileURL } from 'node:url';
import { readConfig, normalizeId, validateRunId } from './config.mjs';
import { NotionClient } from './client.mjs';
import { RunStore } from './state.mjs';
import { dryRun, runPoc } from './engine.mjs';
import { verifyEventually } from './verify.mjs';

export function parseArgs(args) {
  const command = args[0] ?? 'dry-run';
  if (!['dry-run', 'apply', 'inspect', 'verify', 'help', '--help'].includes(command)) throw new Error('명령은 dry-run / apply / inspect / verify / help 중 하나입니다.');
  const options = { runId: 'nb-v2-002' };
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!['--run-id', '--confirm-parent'].includes(key) || !value || value.startsWith('--')) throw new Error('잘못된 옵션 또는 옵션값 누락');
    const name = key === '--run-id' ? 'runId' : 'confirmParent';
    if (options[`seen-${name}`]) throw new Error('중복 옵션');
    options[`seen-${name}`] = true;
    options[name] = value;
  }
  validateRunId(options.runId);
  return { command, ...options };
}

export function summarize(state) {
  return {
    taskId: state.taskId, runId: state.runId, status: state.status, apiVersion: state.apiVersion,
    reusedExistingRun: state.reusedExistingRun === true, parentId: state.parentId,
    page: state.page, databases: state.databases, rows: state.rows, views: state.views,
    verification: Object.fromEntries(Object.entries(state.verification).map(([key, result]) => [key, {
      ok: result.ok, phase: result.phase, expected: result.expected, actual: result.actual,
      failedChecks: result.checks.filter(check => !check.passed), checkedAt: result.checkedAt
    }])),
    failedSteps: state.steps.filter(step => ['failed', 'uncertain'].includes(step.status)),
    attendanceChanged: state.attendanceChanged, visualInspection: state.visualInspection ?? 'not_performed'
  };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const print = value => console.log(JSON.stringify(value, null, 2));
  if (['help', '--help'].includes(options.command)) {
    console.log('Node.js 22+ / 기본값은 네트워크 호출 없는 dry-run입니다.\n'
      + 'node scripts/notion-poc/cli.mjs dry-run\n'
      + 'node --env-file=.env scripts/notion-poc/cli.mjs apply --run-id nb-v2-002 --confirm-parent <승인한-테스트-페이지-UUID>\n'
      + 'node scripts/notion-poc/cli.mjs inspect --run-id nb-v2-002\n'
      + 'node --env-file=.env scripts/notion-poc/cli.mjs verify --run-id nb-v2-002');
    return;
  }
  if (options.command === 'dry-run') { print(dryRun(readConfig())); return; }
  const store = new RunStore(options.runId);
  if (options.command === 'inspect') {
    const state = await store.read();
    if (!state) throw new Error('이 run-id의 실행 기록이 없습니다.');
    print(summarize(state));
    return;
  }
  const config = readConfig(process.env, { live: true });
  const client = new NotionClient({ token: config.token });
  if (options.command === 'verify') {
    await store.lock();
    try {
      const state = await store.read();
      if (!state?.verification?.baseline || !state.rows?.metrics?.summary) throw new Error('KPI 검증 단계까지 진행한 실행 기록이 필요합니다.');
      if (normalizeId(state.parentId) !== config.parentId) throw new Error('현재 테스트 상위 페이지와 실행 기록이 다릅니다.');
      state.verification.latestReadOnly = await verifyEventually(client, state);
      await store.save(state);
      print(summarize(state));
      if (!state.verification.latestReadOnly.ok) process.exitCode = 2;
    } finally { await store.unlock(); }
    return;
  }
  const state = await runPoc({ config, client, store, runId: options.runId, confirmParent: options.confirmParent,
    onProgress: name => console.error(`[NB-V2-002] ${name}`) });
  print(summarize(state));
  if (state.status !== 'complete') process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`실행 중단: ${error.message}`);
    console.error('기존 실행 기록은 보존됩니다. 실패한 run-id를 바꿔 재생성하기 전에 inspect로 확인하세요.');
    process.exitCode = 1;
  });
}
