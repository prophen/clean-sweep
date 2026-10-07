import nextEnv from '@next/env';
import { Pool } from 'pg';
import { chores, personas } from '../lib/game';
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error('Add DATABASE_URL to .env.local first.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
 await client.query('BEGIN');
 await client.query(`
 CREATE TABLE IF NOT EXISTS chores (id uuid PRIMARY KEY, name text NOT NULL, room text NOT NULL, par_seconds integer NOT NULL CHECK(par_seconds>0), icon text NOT NULL, sort_order integer NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS profile (id integer PRIMARY KEY DEFAULT 1 CHECK(id=1), display_name text NOT NULL DEFAULT 'Player 1', total_xp integer NOT NULL DEFAULT 0, level integer NOT NULL DEFAULT 1, current_streak_days integer NOT NULL DEFAULT 0, longest_streak_days integer NOT NULL DEFAULT 0, last_run_date date);
 CREATE TABLE IF NOT EXISTS runs (id uuid PRIMARY KEY, chore_id uuid NOT NULL REFERENCES chores(id), duration_seconds integer NOT NULL CHECK(duration_seconds>0), started_at timestamptz NOT NULL DEFAULT now(), beat_pb boolean NOT NULL DEFAULT false, xp_earned integer NOT NULL DEFAULT 0, result jsonb);
 ALTER TABLE runs ADD COLUMN IF NOT EXISTS result jsonb;
 CREATE TABLE IF NOT EXISTS personal_bests (chore_id uuid PRIMARY KEY REFERENCES chores(id), best_seconds integer NOT NULL, run_id uuid REFERENCES runs(id), achieved_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS personas (id text PRIMARY KEY, name text NOT NULL, tagline text NOT NULL, system_prompt text NOT NULL, voice_id text NOT NULL, unlock_level integer NOT NULL DEFAULT 1, is_default boolean NOT NULL DEFAULT false);
 INSERT INTO profile(id) VALUES(1) ON CONFLICT DO NOTHING;
 `);
 for (const [i,c] of chores.entries()) await client.query('INSERT INTO chores(id,name,room,par_seconds,icon,sort_order) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING', [c.id,c.name,c.room,c.par_seconds,c.icon,i]);
 for (const p of personas) await client.query('INSERT INTO personas(id,name,tagline,system_prompt,voice_id,unlock_level,is_default) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET system_prompt=$4,voice_id=$5', [p.id,p.name,p.tagline,p.system_prompt,p.voice_id,p.unlock_level,p.id==='hype']);
 await client.query('COMMIT'); console.log('Clean Sweep database ready: 5 chores, 3 commentators.');
} catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); await pool.end(); }
