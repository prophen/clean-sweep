import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chores } from '../lib/game';
test('local persistence serializes concurrent finishes and safely replays retries',async()=>{
 const original=process.cwd(); const dir=await mkdtemp(join(tmpdir(),'clean-sweep-test-')); process.chdir(dir);
 try {
 const {finishRun,getProfile,getChores}=await import('../lib/store');
 const id=crypto.randomUUID();
 const [first,retry]=await Promise.all([finishRun(chores[0].id,120,'America/Los_Angeles',id),finishRun(chores[0].id,120,'America/Los_Angeles',id)]);
 assert.deepEqual(first,retry);
 assert.equal((await getProfile()).profile.total_xp,75);
 await Promise.all([finishRun(chores[0].id,100,'America/Los_Angeles',crypto.randomUUID()),finishRun(chores[1].id,60,'America/Los_Angeles',crypto.randomUUID())]);
 const p=(await getProfile()).profile;
 assert.equal(p.total_xp,225); assert.equal(p.current_streak_days,1); assert.equal(p.level,2);
 assert.equal((await getChores())[0].best_seconds,100);
 } finally {process.chdir(original);await rm(dir,{recursive:true,force:true});}
});
