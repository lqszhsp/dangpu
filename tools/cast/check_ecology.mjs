#!/usr/bin/env node
// Additional regression checks for the 55-character batch; no cloud calls or game-file writes.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const roster = JSON.parse(fs.readFileSync(path.join(GAME, 'art/cast_expansion_qwen3pro/roster.json'), 'utf8')).characters;
const html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => f !== 'js/ui.js');
const source = scripts.map(f => fs.readFileSync(path.join(GAME, f), 'utf8')).join('\n;\n')+'\n;var sel = null;';
const g = { console, Math, JSON, Date, setTimeout, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
vm.createContext(g); vm.runInContext(source, g);
const run = s => vm.runInContext(s, g);
const report = [];
assert.equal(roster.length, 55);
assert.equal(new Set(roster.map(r => r.id)).size, 55);
assert.equal(run('Object.values(CAST).filter(d => d.ecologyBatch === "qwen3pro55").length'), 55);
assert.equal(run('typeof CAST.lu_tiechui'), 'object', 'filename ending in ui.js must not be excluded');

for (const role of roster) {
  g.id = role.id;
  assert.equal(run('CAST[id].sex'), role.sex);
  assert.equal(run('FACE_SEX[CAST[id].portrait]'), role.sex);
  assert.equal(run('CAST[id].portrait'), role.id);
  assert.equal(run('!!ITEMS[CAST[id].item]'), true, role.id+' item exists');
  assert.deepEqual(Array.from(run('Object.keys(CAST[id].nodes)')), ['meet', 'pressure', 'hearing', 'aftermath']);

  const setup = (stones = 1000, level = 3) => run(`newGame('normal','apprentice'); S.stones=${stones}; S.cult.lv=${level};
    startStory(id,id,'meet',0); Object.assign(S.people[id],CAST[id].traits); S.people[id].sex=CAST[id].sex;`);
  const choice = n => run(`resolveChoice(id,${n})`);
  const st = () => run('S.story[id]');

  // Aid -> copy -> public verification -> return originals.
  setup(); choice(0); choice(0); choice(0); choice(0);
  assert.equal(st().done, true); assert.equal(st().flags.outcome, 'protected');
  assert.equal(run('S.people[id].owes'), true);

  // No advance aid -> copy -> temporary settlement: not a falsely labelled victory.
  setup(); choice(2); choice(0); choice(1); choice(0);
  assert.equal(st().flags.outcome, 'truce');

  // Sell evidence -> accept consequences: NPC ceases visiting.
  setup(); choice(0); choice(1); choice(0);
  assert.equal(st().flags.outcome, 'betrayed'); assert.equal(run('S.people[id].status'), 'gone');

  // Selling then buying evidence back does not remove betrayal memory.
  setup(); choice(0); choice(1); choice(1);
  assert.equal(st().flags.outcome, 'repaired_betrayal'); assert.ok(run('S.people[id].aff') < 0);

  // No aid -> withdraw, and decline at first visit are independent endings.
  setup(); choice(2); choice(2); assert.equal(st().flags.outcome, 'withdrawn');
  setup(); choice(3); assert.equal(st().flags.outcome, 'declined');

  // Strong player can recruit an informant; there is no guaranteed rare treasure.
  setup(); choice(0); choice(0); choice(0); choice(1);
  assert.equal(st().flags.outcome, 'informant'); assert.equal(run('S.people[id].informant'), true);

  // Low cash and low power gates must really disable costly/strong choices.
  setup(0, 1);
  assert.ok(run('choiceState(CAST[id].nodes.meet.choices(S.story[id],S.people[id])[0],S.story[id],S.people[id])'));
  choice(2);
  assert.ok(run('choiceState(CAST[id].nodes.pressure.choices(S.story[id],S.people[id])[0],S.story[id],S.people[id])'));
  setup(1000, 1); choice(0); choice(0); choice(0);
  assert.ok(run('choiceState(CAST[id].nodes.aftermath.choices(S.story[id],S.people[id])[1],S.story[id],S.people[id])'));

  // Hooks: only one fair trade credit, and death cannot leave a forever-blocked story.
  setup();
  run(`var poisoned=makeItem(CAST[id].item,{q:70,laced:'poison'});castEvent(S.people[id],'sold',poisoned,0);`);
  assert.equal(st().flags.tradeHelp, undefined, role.id+' poisoned goods must not count as help');
  run(`var testItem=makeItem(CAST[id].item,{q:70}); castEvent(S.people[id],'sold',testItem,0);`);
  assert.equal(st().flags.tradeHelp, true);
  const before = run('S.people[id].aff');
  run(`castEvent(S.people[id],'sold',testItem,1);`); assert.equal(run('S.people[id].aff'), before);
  run(`S.people[id].status='dead';castEvent(S.people[id],'death');`);
  assert.equal(st().done, true); assert.equal(st().flags.outcome, 'death');
  report.push({ id: role.id, endings: 7, tested: 'branches, cost/power gates, trade/death hooks, sex, item, portrait identity' });
}

// Runtime art gate: uninstalled assets must not create invisible visitors.
run(`newGame('normal','apprentice'); S.day=300; for(const d of Object.values(CAST)) {
 if(d.ecologyBatch==='qwen3pro55') ART_SET.delete('chars/'+d.id);
} castTick();`);
assert.equal(run('Object.keys(S.story).filter(k=>CAST[k]&&CAST[k].ecologyBatch==="qwen3pro55").length'), 0);

// In-memory art fixtures only: ensure at most four active ecology arcs even if all are due.
run(`newGame('normal','apprentice'); S.day=300; for(const d of Object.values(CAST)) {
 if(d.ecologyBatch==='qwen3pro55') ART_SET.add('chars/'+d.id);
} for(let n=0;n<100;n++)castTick();`);
assert.equal(run('Object.keys(S.story).filter(k=>CAST[k]&&CAST[k].ecologyBatch==="qwen3pro55").length'), 4);
console.log(JSON.stringify({ characters: report.length, deterministic_paths: report.length*7,
  cost_and_power_gates: 'passed', lifecycle_hooks: 'passed', registration: 'passed', active_story_cap: 4,
  note: 'This test does not certify image quality or image completeness; use cast.mjs check after installation.' }, null, 2));
