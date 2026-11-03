import {TEST_ENV_NAMES} from '../../server/notion/test-configuration.mjs';
import {reject} from '../../server/review-errors.mjs';

// No readline echo, shell commands, process.env writes, file output, or value logging.
export async function readHiddenConfiguration({input = process.stdin, output = process.stdout, signals = process} = {}) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') reject(400, 'local_tty_required');
  const names = Object.values(TEST_ENV_NAMES), values = {}, previousRaw = input.isRaw === true;
  let pending = '', index = 0, finished = false;
  return new Promise((resolve, fail) => {
    function cleanup() {
      input.removeListener('data', data); input.removeListener('error', streamError); input.removeListener('end', end);
      for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) signals.removeListener(name, cancel);
      signals.removeListener('exit', restore);
      pending = '';
      restore(); input.pause();
    }
    function restore() {try {input.setRawMode(previousRaw);} catch { /* no credential/error output */ }}
    function finish(error) {
      if (finished) return; finished = true;
      cleanup();
      if (error) {for (const key of names) delete values[key]; fail(error);}
      else resolve(values);
    }
    function cancel() {finish(Object.assign(new Error('local_input_cancelled'), {code: 'local_input_cancelled'}));}
    function streamError() {finish(Object.assign(new Error('local_input_failed'), {code: 'local_input_failed'}));}
    function end() {streamError();}
    function prompt() {output.write(`${names[index]} (가상 값만, 입력 숨김): `);}
    function data(chunk) {
      try {
        for (const ch of chunk.toString('utf8')) {
          if (finished) break;
          if (ch === '\x03' || ch === '\x04') {cancel(); break;}
          if (ch === '\r' || ch === '\n') {
            // A CRLF pair is not silently accepted as a second (empty) field.
            if (!pending) {streamError(); break;}
            values[names[index++]] = pending; pending = ''; output.write('\n');
            if (index === names.length) finish(); else prompt();
          } else if (ch === '\x7f' || ch === '\b') pending = pending.slice(0, -1);
          else if (/^[\x20-\x7e]$/.test(ch) && pending.length < 512) pending += ch;
          else {streamError(); break;}
        }
      } catch {streamError();}
    }
    input.on('data', data); input.once('error', streamError); input.once('end', end);
    for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) signals.once(name, cancel);
    signals.once('exit', restore);
    try {input.setRawMode(true); prompt(); input.resume();} catch {streamError();}
  });
}
