import { formatTime, type Chore } from './game';
export const events = ['run_start', 'halfway', 'final_push', 'finish_baseline', 'finish_pb', 'finish_miss', 'streak_milestone'] as const;
export type Event = typeof events[number];
export function finishEvent(firstRun: boolean, beatPb: boolean): Event {
 return firstRun ? 'finish_baseline' : beatPb ? 'finish_pb' : 'finish_miss';
}
export function commentaryContext(event: Event, chore: Chore, elapsed: number, streak: number) {
 const finished = event.startsWith('finish_');
 const best = chore.best_seconds;
 const outcome = !finished ? null : best === null ? 'baseline_set' : elapsed < best ? 'new_personal_best' : elapsed === best ? 'personal_best_tied' : 'completed_without_new_personal_best';
 return { event: finished ? finishEvent(best === null, best !== null && elapsed < best) : event, chore: chore.name, par_seconds: chore.par_seconds, personal_best_seconds: best, elapsed_seconds: elapsed, streak, run_finished: finished, outcome, seconds_under_par: finished ? chore.par_seconds - elapsed : null, seconds_faster_than_previous_best: finished && best !== null ? best - elapsed : null };
}
export const commentaryRules = 'Give only 1-2 short spoken sentences, at most 45 words. No stage directions. Never invent progress: elapsed time is the only pace information. At halfway describe time remaining, not how much work is done. When run_finished is true, the chore is COMPLETE: never say almost there, keep going, or imply the player failed to finish. Use outcome as the result, not the event name. baseline_set means the first completed run establishes a record: celebrate it, never call it a miss. A positive seconds_under_par means they beat par; zero means they matched par. Missing a previous PB only means no new record, never a failed chore. Do not say so close unless the supplied gap is at most five seconds. Do not claim to see the room or know how clean it looks. Speak durations as minutes and seconds.';
export function fallback(event: Event, chore: Chore, elapsed: number, streak: number, persona: string) {
 const target = formatTime(chore.par_seconds);
 const best = chore.best_seconds;
 const lines = {
 run_start: `${chore.name} is live! Par is ${target}.${best === null ? ' Your first run sets the benchmark.' : ` The record to beat is ${formatTime(best)}.`} Let’s make this place shine.`,
 halfway: `Halfway to par. ${best !== null && elapsed >= best ? 'The record has slipped away, but the finish is still yours.' : 'Still in the hunt. Keep that rhythm going!'} Every little win counts.`,
 final_push: 'Thirty seconds to par! Bring it home. The crowd is on its feet, and that last corner is calling your name.',
 finish_baseline: `Baseline set at ${formatTime(elapsed)}! ${elapsed < chore.par_seconds ? `${chore.par_seconds - elapsed} seconds under par. ` : ''}Now you have a record to chase.`,
 finish_pb: `${formatTime(elapsed)}! A new personal best, ${best === null ? '' : `${best - elapsed} seconds faster! `}That is championship cleaning.`,
 finish_miss: best === null ? `Baseline set at ${formatTime(elapsed)}! The arena is clean, and now you have a record to chase.` : `Finished in ${formatTime(elapsed)}. ${elapsed - best} seconds off your record. The mess lost anyway. Run it back!`,
 streak_milestone: `${streak} days in a row! That is a streak worthy of a standing ovation. Keep showing up.`,
 };
 if (event === 'finish_baseline') {
  if (persona === 'golf') return `A baseline of ${formatTime(elapsed)}. ${elapsed < chore.par_seconds ? `${chore.par_seconds - elapsed} seconds under par. ` : ''}An elegant opening round.`;
  if (persona === 'drill') return `Baseline set! ${formatTime(elapsed)}! Mission complete. That’s your benchmark, recruit!`;
  return lines.finish_baseline;
 }
 if (persona === 'golf') return ({ run_start: `${chore.name}. Par ${target}. ${best === null ? 'A first benchmark awaits.' : `The record stands at ${formatTime(best)}.`} A quiet moment before the sponge.`, halfway: 'Halfway to par. A composed approach. The dust seems nervous.', final_push: 'Thirty seconds to par. The room has gone remarkably quiet. A delicate finish awaits.', finish_pb: `A new record of ${formatTime(elapsed)}. Extraordinary composure. A polite round of applause.`, finish_miss: best === null ? `A baseline of ${formatTime(elapsed)}. An elegant opening round.` : `${formatTime(elapsed)}. The record survives. The clutter, happily, does not.`, streak_milestone: `${streak} consecutive days. A remarkably consistent player.` })[event];
 if (persona === 'drill') return ({ run_start: `${chore.name}! Target ${target}! ${best === null ? 'Set your baseline.' : `Record ${formatTime(best)}.`} Move with purpose!`, halfway: 'Halfway to par! Stay steady. One corner at a time!', final_push: 'Thirty seconds to par! Finish strong, recruit!', finish_pb: `New record! ${formatTime(elapsed)}! Outstanding effort!`, finish_miss: `${formatTime(elapsed)}! Mission complete. Next time we sharpen that split!`, streak_milestone: `${streak} days of showing up! That is discipline!` })[event];
 return lines[event];
}
