import { RELATIONS } from '../schema.mjs';

export const PARENT_ID = '11111111-1111-4111-8111-111111111111';

// Test double for transport/orchestration tests. It is NOT a Notion formula
// interpreter and cannot establish real API or formula compatibility.
export class FakeNotion {
  constructor({ rejectDashboard = false, rejectChart = false, failSeed = false, wrongCalculation = false } = {}) {
    this.options = { rejectDashboard, rejectChart, failSeed, wrongCalculation };
    this.counter = 1; this.calls = []; this.pages = new Map(); this.databases = new Map(); this.sources = new Map(); this.views = new Map();
    this.pages.set(PARENT_ID, { object: 'page', id: PARENT_ID, parent: { workspace: true }, properties: {} });
  }
  id() { return `00000000-0000-4000-8000-${String(this.counter++).padStart(12, '0')}`; }
  property(name, definition) { return { id: `p${this.counter++}`, name, type: Object.keys(definition)[0], ...structuredClone(definition) }; }
  record(method, path, body) { this.calls.push({ method, path, body: structuredClone(body) }); }
  async get(path) {
    this.record('GET', path);
    const [, , type, id] = path.split('/');
    const map = { pages: this.pages, databases: this.databases, data_sources: this.sources, views: this.views }[type];
    const value = map?.get(id);
    if (!value) throw new Error(`fake missing ${type}`);
    return structuredClone(value);
  }
  async post(path, body) {
    this.record('POST', path, body);
    if (path === '/v1/pages') {
      if (body.parent.data_source_id && this.options.failSeed) throw new Error('simulated seed failure');
      const id = this.id();
      const page = { object: 'page', id, parent: body.parent, properties: structuredClone(body.properties), url: `https://www.notion.so/${id}` };
      this.pages.set(id, page);
      return structuredClone(page);
    }
    if (path === '/v1/databases') {
      const id = this.id(), sourceId = this.id();
      const db = { object: 'database', id, parent: body.parent, title: body.title, data_sources: [{ id: sourceId }], url: `https://www.notion.so/${id}` };
      this.databases.set(id, db);
      this.sources.set(sourceId, { object: 'data_source', id: sourceId, parent: { database_id: id }, properties: Object.fromEntries(Object.entries(body.initial_data_source.properties).map(([name, def]) => [name, this.property(name, def)])) });
      return structuredClone(db);
    }
    if (path === '/v1/views') {
      if ((body.type === 'dashboard' && this.options.rejectDashboard) || (body.type === 'chart' && this.options.rejectChart)) {
        const { NotionError } = await import('../client.mjs');
        throw new NotionError({ status: 400, code: 'validation_error' });
      }
      const id = this.id();
      const view = { object: 'view', id, ...structuredClone(body), configuration: body.type === 'dashboard' ? { type: 'dashboard', rows: [] } : structuredClone(body.configuration ?? { type: body.type }), url: `https://www.notion.so/view-${id}` };
      if (body.view_id) {
        const rows = this.views.get(body.view_id).configuration.rows;
        const widget = { view_id: id };
        if (body.placement.type === 'new_row') rows.push({ widgets: [widget] });
        else rows[body.placement.row_index].widgets.push(widget);
      }
      this.views.set(id, view);
      return structuredClone(view);
    }
    throw new Error('unimplemented fake POST');
  }
  async patch(path, body) {
    this.record('PATCH', path, body);
    const [, , type, id] = path.split('/');
    if (type === 'pages') {
      Object.assign(this.pages.get(id).properties, structuredClone(body.properties));
      return structuredClone(this.pages.get(id));
    }
    const source = this.sources.get(id);
    for (const [nameOrId, definition] of Object.entries(body.properties)) {
      if (definition.name) {
        const old = Object.values(source.properties).find(p => p.id === nameOrId);
        delete source.properties[old.name];
        old.name = definition.name;
        source.properties[old.name] = old;
        continue;
      }
      const property = this.property(nameOrId, definition);
      if (definition.relation?.type === 'dual_property') {
        const target = this.sources.get(definition.relation.data_source_id);
        const reverse = this.property(`auto-${property.id}`, { relation: { data_source_id: id, type: 'dual_property', dual_property: { synced_property_id: property.id } } });
        target.properties[reverse.name] = reverse;
        property.relation.dual_property = { synced_property_id: reverse.id };
      }
      source.properties[nameOrId] = property;
    }
    return structuredClone(source);
  }
  sourceKey(id) {
    const name = this.databases.get(this.sources.get(id).parent.database_id).title[0].text.content;
    return { '신청자 DB': 'applicants', '과정 DB': 'courses', '과정별 신청기록 DB': 'applications', '수강 DB': 'enrollments', '출석기록 DB': 'attendance', '교육 KPI DB': 'metrics' }[name];
  }
  async queryAll(id) {
    this.record('QUERY', id);
    const all = [...this.pages.values()].filter(p => p.parent.data_source_id);
    const sourceId = key => [...this.sources.keys()].find(id => this.sourceKey(id) === key);
    const rows = key => all.filter(p => p.parent.data_source_id === sourceId(key));
    const forwardIds = (page, name) => page.properties[name]?.relation?.map(r => r.id) ?? [];
    const related = (page, name) => forwardIds(page, name).map(id => this.pages.get(id));
    const accepted = page => page.properties['출석 상태']?.select?.name === '출석';
    const completed = page => page.properties['수료']?.checkbox === true;
    const back = (page, key, name) => rows(key).filter(p => forwardIds(p, name).includes(page.id));
    const computed = (n, type = 'formula') => ({ type, [type]: { type: 'number', number: n } });
    return all.filter(p => p.parent.data_source_id === id).map(original => {
      const p = structuredClone(original), key = this.sourceKey(id), values = p.properties;
      for (const [name, value] of Object.entries(values)) {
        values[name].type ??= Object.keys(value)[0];
        values[name].id ??= this.sources.get(id).properties[name].id;
      }
      for (const r of RELATIONS.filter(r => r.reverse && r.target === key)) values[r.reverse] = { type: 'relation', relation: back(original, r.source, r.name).map(p => ({ id: p.id })) };
      const set = (name, n, type) => values[name] = computed(n, type);
      if (key === 'attendance') {
        values['출석 인정 여부'] = { type: 'formula', formula: { type: 'boolean', boolean: accepted(original) } };
        set('출석 인정 값', accepted(original) ? 1 : 0);
      }
      if (key === 'enrollments') {
        const attendance = back(original, 'attendance', '수강');
        set('출석 건수', attendance.filter(accepted).length, 'rollup');
        set('예정 건수', attendance.length);
        set('출석률', attendance.filter(accepted).length / attendance.length * 100);
        set('수료 값', completed(original) ? 1 : 0);
      }
      if (key === 'courses') {
        const enrollments = back(original, 'enrollments', '과정');
        set('수강인원', enrollments.length);
        set('수료건수', enrollments.filter(completed).length, 'rollup');
      }
      if (key === 'metrics') {
        const applicants = related(original, '신청자'), applications = related(original, '신청기록'), enrollments = related(original, '수강'), attendance = related(original, '출석기록');
        const countPeople = list => new Set(list.flatMap(p => forwardIds(p, '신청자'))).size;
        set('신청자 수', applicants.length); set('신청기록 수', applications.length);
        set('선정 고유 인원', countPeople(applications.filter(p => p.properties['선정 상태'].select.name === '선정'))); set('수강기록 수', enrollments.length);
        set('수료기록 수', enrollments.filter(completed).length, 'rollup'); set('수료인원', countPeople(enrollments.filter(completed)));
        set('수료율', enrollments.filter(completed).length / enrollments.length * 100);
        set('출석 건수', attendance.filter(accepted).length, 'rollup'); set('예정 건수', attendance.length);
        set('출석률', this.options.wrongCalculation ? -1 : attendance.filter(accepted).length / attendance.length * 100);
      }
      return p;
    });
  }
}
