import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('V1: 256 module combinations still produce consistent schemas and export text', async () => {
  const mock = await readFile(new URL('../../../js/mock-data.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../../js/app.js', import.meta.url), 'utf8');
  new vm.Script(app);
  const context = { document: { body: { dataset: { page: 'test' } } } }; context.window = context;
  vm.createContext(context); vm.runInContext(mock, context);
  vm.runInContext(app.replace(/\}\)\(\);\s*$/, 'globalThis.audit={buildDesign,designToText};})();'), context);
  const data = context.MOCK_DASHBOARD_DATA, ids = [...data.basicOrder, ...data.additionalOrder];
  for (let mask = 0; mask < 256; mask++) {
    const selected = ids.filter((id, i) => mask & (1 << i));
    const req = { educationName: '회귀 검사', purpose: '', requirements: '기존 요구사항', basicItems: selected.filter(id => data.basicOrder.includes(id)), additionalItems: selected.filter(id => data.additionalOrder.includes(id)) };
    const result = context.audit.buildDesign(req);
    assert.equal(result.databases.length, selected.length + 1);
    for (const formula of result.formulas) {
      const db = result.databases.find(db => db.name === formula.database);
      for (const property of formula.references) assert.ok(db.properties.some(p => p.name === property));
    }
    assert.ok(context.audit.designToText(result).includes('기존 요구사항'));
  }
});
