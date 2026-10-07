export type Chore = { id: string; name: string; room: string; par_seconds: number; icon: string; best_seconds: number | null };
export type Persona = { id: string; name: string; tagline: string; voice_id: string; unlock_level: number; system_prompt: string };
export type Profile = { display_name: string; total_xp: number; level: number; current_streak_days: number; longest_streak_days: number; last_run_date: string | null };
export type Run = { id: string; chore_id: string; duration_seconds: number; started_at: string; beat_pb: boolean; xp_earned: number };
export const chores: Chore[] = [
 { id: '11111111-1111-4111-8111-111111111111', name: 'Kitchen clean', room: 'Kitchen', par_seconds: 720, icon: 'sparkles', best_seconds: null },
 { id: '22222222-2222-4222-8222-222222222222', name: 'Dishes', room: 'Kitchen', par_seconds: 480, icon: 'utensils', best_seconds: null },
 { id: '33333333-3333-4333-8333-333333333333', name: 'Laundry fold', room: 'Laundry', par_seconds: 600, icon: 'shirt', best_seconds: null },
 { id: '44444444-4444-4444-8444-444444444444', name: 'Bathroom reset', room: 'Bathroom', par_seconds: 420, icon: 'bath', best_seconds: null },
 { id: '55555555-5555-4555-8555-555555555555', name: 'Living room vacuum', room: 'Living room', par_seconds: 360, icon: 'wind', best_seconds: null },
];
export const personas: Persona[] = [
 { id: 'hype', name: 'Hype Caster', tagline: 'Every wipe. Championship energy.', voice_id: 'aura-2-apollo-en', unlock_level: 1, system_prompt: 'You are an energetic esports caster commentating chores. Be warm, vivid, and playful. Never shame the player.' },
 { id: 'golf', name: 'Golf Whisper', tagline: 'Quiet voice. Unreasonably high stakes.', voice_id: 'aura-2-thalia-en', unlock_level: 1, system_prompt: 'You are a hushed golf commentator watching chores. Use dry wit, understated suspense, and warmth.' },
 { id: 'drill', name: 'Drill Sergeant', tagline: 'Your mess has met its match.', voice_id: 'aura-2-aries-en', unlock_level: 3, system_prompt: 'You are a playful drill sergeant coaching chores. Be punchy and motivating, never abusive or demeaning.' },
];
export const initialProfile: Profile = { display_name: 'Player 1', total_xp: 0, level: 1, current_streak_days: 0, longest_streak_days: 0, last_run_date: null };
export const thresholds = [0, 200, 500, 1000, 1750, 2750];
export function thresholdFor(level: number): number { return thresholds[level - 1] ?? 2750 + (level - 6) * 1250 + ((level - 6) * (level - 7) / 2) * 250; }
export function levelFor(xp: number) { let level = 1; while (xp >= thresholdFor(level + 1)) level++; return level; }
export function formatTime(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`; }
export function dateInZone(now: Date, timezone: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function scoreRun(profile: Profile, best: number | null, duration: number, today: string) {
 const first = best === null;
 const beat_pb = !first && duration < best;
 const newDay = profile.last_run_date !== today;
 const yesterday = new Date(`${today}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
 const streak = newDay ? (profile.last_run_date === yesterday.toISOString().slice(0,10) ? profile.current_streak_days + 1 : 1) : profile.current_streak_days;
 const xp = 50 + (beat_pb ? 50 : 0) + (newDay ? 25 : 0);
 const updated = { ...profile, total_xp: profile.total_xp + xp, level: levelFor(profile.total_xp + xp), current_streak_days: streak, longest_streak_days: Math.max(streak, profile.longest_streak_days), last_run_date: today };
 return { first_run: first, beat_pb, previous_best: best, best_seconds: best === null ? duration : Math.min(best, duration), delta: best === null ? null : duration - best, xp_earned: xp, xp_breakdown: { finish: 50, personal_best: beat_pb ? 50 : 0, streak: newDay ? 25 : 0 }, level_up: updated.level > profile.level, profile: updated };
}
