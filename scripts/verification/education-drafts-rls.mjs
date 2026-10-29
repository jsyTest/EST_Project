// Local SQL verification only. No Supabase URL, credentials or remote connection is used.
// node scripts/verification/education-drafts-rls.mjs /absolute/path/to/pglite/dist/index.js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {emptyConfiguration} from '../../js/drafts/model.mjs';
if (!process.argv[2]) throw new Error('Pass an installed PGlite module path; see docs/storage/NB-V2-006_DB_PLAN.md.');
const {PGlite} = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
let passed = 0;
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
async function as(role, uid) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || '']);
  await db.exec(`set role ${role}`);
}
const configuration = JSON.stringify(emptyConfiguration());
try {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');
    alter default privileges in schema public grant all on tables to anon, authenticated;`);
  await db.exec(await readFile(new URL('../../database/education-drafts.sql', import.meta.url), 'utf8'));
  await check('anonymous SELECT/INSERT denied', async () => {
    await as('anon'); await assert.rejects(db.query('select * from public.education_drafts'), {code: '42501'});
    await assert.rejects(db.query('insert into public.education_drafts(title,configuration) values ($1,$2)', ['anonymous', configuration]), {code: '42501'});
    const privileges = (await db.query("select has_function_privilege('anon','public.education_drafts_touch_updated_at()','execute') as anon_execute, has_function_privilege('authenticated','public.education_drafts_touch_updated_at()','execute') as authenticated_execute")).rows[0];
    assert.equal(privileges.anon_execute, false); assert.equal(privileges.authenticated_execute, false);
  });
  let a, b;
  await check('A inserts with server-assigned auth.uid owner', async () => {
    await as('authenticated', A);
    a = (await db.query('insert into public.education_drafts(title,configuration) values ($1,$2) returning *, updated_at::text as stamp', ['A draft', configuration])).rows[0];
    assert.equal(a.user_id, A);
  });
  await check('B inserts and sees only own row', async () => {
    await as('authenticated', B);
    b = (await db.query('insert into public.education_drafts(title,configuration) values ($1,$2) returning *, updated_at::text as stamp', ['B draft', configuration])).rows[0];
    assert.equal(b.user_id, B); assert.deepEqual((await db.query('select id from public.education_drafts')).rows.map(x => x.id), [b.id]);
  });
  await check('A cannot read B by known UUID', async () => {
    await as('authenticated', A); assert.equal((await db.query('select * from public.education_drafts where id=$1', [b.id])).rows.length, 0);
  });
  await check('A cannot update B by known UUID', async () => {
    assert.equal((await db.query("update public.education_drafts set title='tampered' where id=$1 returning id", [b.id])).rows.length, 0);
  });
  await check('forged owner INSERT is denied by column privileges', async () => {
    await assert.rejects(db.query('insert into public.education_drafts(user_id,title,configuration) values ($1,$2,$3)', [B, 'forged', configuration]), {code: '42501'});
  });
  await check('owner reassignment UPDATE denied', async () => {
    await assert.rejects(db.query('update public.education_drafts set user_id=$1 where id=$2', [B, a.id]), {code: '42501'});
  });
  await check('own update works and timestamp is server-updated', async () => {
    const next = (await db.query("update public.education_drafts set title='A revised' where id=$1 returning *, updated_at::text as stamp", [a.id])).rows[0];
    assert.equal(next.title, 'A revised'); assert.notEqual(next.stamp, a.stamp);
  });
  await check('stale optimistic update matches zero rows', async () => {
    assert.equal((await db.query("update public.education_drafts set title='stale' where id=$1 and updated_at=$2 returning id", [a.id, a.stamp])).rows.length, 0);
  });
  await check('DELETE is denied for own and other rows', async () => {
    for (const id of [a.id, b.id]) await assert.rejects(db.query('delete from public.education_drafts where id=$1', [id]), {code: '42501'});
  });
  await check('invalid and missing JSON fields rejected by CHECK', async () => {
    for (const value of ['null', '{}', '{"version":null,"requirements":{},"mapping":{}}', '{"version":2,"requirements":{},"mapping":{}}']) {
      await assert.rejects(db.query('insert into public.education_drafts(title,configuration) values ($1,$2)', ['invalid', value]), {code: '23514'});
    }
  });
  await check('authenticated role without auth.uid cannot read/insert', async () => {
    await as('authenticated'); assert.equal((await db.query('select * from public.education_drafts')).rows.length, 0);
    await assert.rejects(db.query('insert into public.education_drafts(title,configuration) values ($1,$2)', ['missing uid', configuration]));
  });
  await check('UPDATE RLS checks both old/new owner even if owner-column privilege is granted in fixture', async () => {
    await db.exec('reset role; grant update(user_id) on public.education_drafts to authenticated; alter table public.education_drafts disable trigger education_drafts_update_timestamp;');
    await as('authenticated', A);
    await assert.rejects(db.query('update public.education_drafts set user_id=$1 where id=$2', [B, a.id]), {code: '42501'});
    assert.equal((await db.query('update public.education_drafts set user_id=$1 where id=$2 returning id', [A, b.id])).rows.length, 0);
  });
  console.log(JSON.stringify({engine: 'local PGlite/Postgres', passed, remoteDbChanged: false}));
} finally { await db.close(); }
