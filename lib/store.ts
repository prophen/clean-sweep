import { Pool } from 'pg';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { chores, initialProfile, personas, scoreRun, dateInZone, type Profile, type Run, type Persona } from './game';
const globals = globalThis as unknown as { gamePool?: Pool; gameQueue?: Promise<unknown> };
export function pool() { return globals.gamePool ??= new Pool({ connectionString: process.env.DATABASE_URL }); }
type State = { profile: Profile; bests: Record<string, number>; runs: Run[]; results: Record<string, ReturnType<typeof scoreRun> & { run: Run }> };
const path = join(process.cwd(), '.data', 'game.json');
async function localState(): Promise<State> {
 if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production.');
 try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; return { profile: { ...initialProfile }, bests: {}, runs: [], results: {} }; }
}
export async function getChores() {
 if (!process.env.DATABASE_URL) { const state = await localState(); return chores.map(c => ({ ...c, best_seconds: state.bests[c.id] ?? null })); }
 return (await pool().query('SELECT c.*, p.best_seconds FROM chores c LEFT JOIN personal_bests p ON c.id=p.chore_id ORDER BY c.sort_order')).rows;
}
export async function getPersonas(): Promise<Persona[]> {
 return process.env.DATABASE_URL ? (await pool().query('SELECT * FROM personas ORDER BY unlock_level, is_default DESC, name')).rows : personas;
}
export async function getProfile() {
 const profile = process.env.DATABASE_URL ? (await pool().query("SELECT *, to_char(last_run_date, 'YYYY-MM-DD') AS last_run_date FROM profile WHERE id=1")).rows[0] as Profile : (await localState()).profile;
 if (!profile) throw new Error('Database not initialized. Run npm run db:setup.');
 return { profile, personas: (await getPersonas()).map(({ system_prompt: _, ...p }) => ({ ...p, unlocked: profile.level >= p.unlock_level })), storage: process.env.DATABASE_URL ? 'neon' : 'local' };
}
export async function finishRun(choreId: string, duration: number, timezone: string, requestId: string) {
 const today = dateInZone(new Date(), timezone);
 if (!process.env.DATABASE_URL) {
 const task = (globals.gameQueue ?? Promise.resolve()).catch(() => {}).then(async () => {
 const state = await localState();
 if (state.results[requestId]) return state.results[requestId];
 const result = scoreRun(state.profile, state.bests[choreId] ?? null, duration, today);
 const run: Run = { id: requestId, chore_id: choreId, duration_seconds: duration, started_at: new Date(Date.now() - duration * 1000).toISOString(), beat_pb: result.beat_pb, xp_earned: result.xp_earned };
 state.profile = result.profile; state.bests[choreId] = result.best_seconds; state.runs.push(run); state.results[requestId] = { ...result, run };
 await mkdir(join(process.cwd(), '.data'), { recursive: true }); await writeFile(path + '.tmp', JSON.stringify(state)); await rename(path + '.tmp', path);
 return state.results[requestId];
 }); globals.gameQueue = task; return task;
 }
 const client = await pool().connect();
 try {
 await client.query('BEGIN');
 const p = (await client.query("SELECT *, to_char(last_run_date, 'YYYY-MM-DD') AS last_run_date FROM profile WHERE id=1 FOR UPDATE")).rows[0];
 const existing = (await client.query('SELECT result FROM runs WHERE id=$1', [requestId])).rows[0];
 if (existing) { await client.query('COMMIT'); return existing.result; }
 const best = (await client.query('SELECT best_seconds FROM personal_bests WHERE chore_id=$1', [choreId])).rows[0]?.best_seconds ?? null;
 const result = scoreRun(p, best, duration, today);
 const run: Run = { id: requestId, chore_id: choreId, duration_seconds: duration, started_at: new Date(Date.now() - duration * 1000).toISOString(), beat_pb: result.beat_pb, xp_earned: result.xp_earned };
 const full = { ...result, run };
 await client.query('INSERT INTO runs(id,chore_id,duration_seconds,started_at,beat_pb,xp_earned,result) VALUES($1,$2,$3,$4,$5,$6,$7)', [run.id,choreId,duration,run.started_at,run.beat_pb,run.xp_earned,JSON.stringify(full)]);
 if (result.first_run || result.beat_pb) await client.query('INSERT INTO personal_bests(chore_id,best_seconds,run_id) VALUES($1,$2,$3) ON CONFLICT(chore_id) DO UPDATE SET best_seconds=$2,run_id=$3,achieved_at=now()', [choreId,duration,requestId]);
 const u = result.profile;
 await client.query('UPDATE profile SET total_xp=$1,level=$2,current_streak_days=$3,longest_streak_days=$4,last_run_date=$5 WHERE id=1', [u.total_xp,u.level,u.current_streak_days,u.longest_streak_days,u.last_run_date]);
 await client.query('COMMIT'); return full;
 } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
