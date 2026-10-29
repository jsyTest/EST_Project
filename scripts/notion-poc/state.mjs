import { mkdir, open, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { validateRunId } from './config.mjs';

export class RunStore {
  constructor(runId, directory = resolve('.notion-poc-state')) {
    this.runId = validateRunId(runId);
    this.directory = directory;
    this.path = join(directory, `${runId}.json`);
    this.lockPath = join(directory, `${runId}.lock`);
  }
  async lock() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try { this.handle = await open(this.lockPath, 'wx', 0o600); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('동일 run-id 작업이 실행 중이거나 잠금이 남아 있습니다. 재생성하지 말고 상태를 확인하세요.');
      throw error;
    }
  }
  async unlock() {
    if (this.handle) {
      await this.handle.close();
      this.handle = null;
      await unlink(this.lockPath);
    }
  }
  async read() {
    try { return JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return null;
      throw new Error('상태 파일을 읽을 수 없습니다. 새로 생성하지 말고 수동 확인이 필요합니다.');
    }
  }
  async save(state) {
    const temporary = `${this.path}.tmp-${process.pid}`;
    await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    await rename(temporary, this.path);
  }
}
