import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentaryContext, finishEvent, fallback } from '../lib/commentary';
import { chores, initialProfile, scoreRun } from '../lib/game';
const vacuum = chores[4];
test('296-second first vacuum run is a completed baseline 64 seconds under par', () => {
 const result = scoreRun(initialProfile, null, 296, '2026-10-07');
 assert.equal(finishEvent(result.first_run, result.beat_pb), 'finish_baseline');
 // Older clients may still label a baseline finish_miss.
 const context = commentaryContext('finish_miss', vacuum, 296, 1);
 assert.equal(context.event, 'finish_baseline');
 assert.equal(context.outcome, 'baseline_set');
 assert.equal(context.run_finished, true);
 assert.equal(context.seconds_under_par, 64);
 assert.equal(context.seconds_faster_than_previous_best, null);
 for (const persona of ['hype', 'golf', 'drill']) {
  const line = fallback('finish_baseline', vacuum, 296, 1, persona);
  assert.match(line, /baseline/i);
  assert.doesNotMatch(line, /\bmiss\b|almost there|so close/i);
 }
});
test('beating par and missing a previous PB are separate facts', () => {
 const context = commentaryContext('finish_miss', {...vacuum, best_seconds: 280}, 296, 1);
 assert.equal(context.outcome, 'completed_without_new_personal_best');
 assert.equal(context.run_finished, true);
 assert.equal(context.seconds_under_par, 64);
 assert.equal(context.seconds_faster_than_previous_best, -16);
});
test('PB improvements and ties have explicit finished outcomes', () => {
 const record = {...vacuum, best_seconds: 296};
 const pb = commentaryContext('finish_pb', record, 280, 1);
 assert.equal(pb.outcome, 'new_personal_best');
 assert.equal(pb.seconds_faster_than_previous_best, 16);
 assert.equal(commentaryContext('finish_miss', record, 296, 1).outcome, 'personal_best_tied');
 assert.equal(commentaryContext('halfway', record, 180, 1).run_finished, false);
});

test('kitchen introduction preserves twelve-minute par even when AI invents seven', async () => {
 const { composeCommentary } = await import('../lib/commentary');
 const context = commentaryContext('run_start', chores[0], 0, 1);
 const wrong = composeCommentary(context, 'Diving in with seven minutes to par!');
 assert.match(wrong.text, /par is 12 minutes/);
 assert.doesNotMatch(wrong.text, /seven/);
 assert.equal(wrong.generated, false);
 const valid = composeCommentary(context, 'The crowd is ready. Let’s make this place shine!');
 assert.match(valid.text, /par is 12 minutes/);
 assert.match(valid.text, /The crowd is ready/);
 assert.equal(valid.generated, true);
});
test('remaining time is calculated, including delayed final-push events', async () => {
 const { commentaryFacts } = await import('../lib/commentary');
 assert.equal(commentaryFacts(commentaryContext('halfway', chores[0], 360, 1)), '6 minutes remaining before par.');
 assert.equal(commentaryFacts(commentaryContext('final_push', chores[0], 695, 1)), '25 seconds remaining before par.');
 assert.equal(commentaryFacts(commentaryContext('final_push', chores[0], 725, 1)), '5 seconds past par.');
});

test('fallback encouragement changes between start, halfway, and final push', async () => {
 const { composeCommentary } = await import('../lib/commentary');
 const start = composeCommentary(commentaryContext('run_start', vacuum, 0, 1));
 const halfway = composeCommentary(commentaryContext('halfway', vacuum, 180, 1), undefined, [start.text]);
 const final = composeCommentary(commentaryContext('final_push', vacuum, 330, 1), undefined, [start.text, halfway.text]);
 assert.match(start.text, /bring the energy/);
 assert.doesNotMatch(halfway.text, /bring the energy/);
 assert.doesNotMatch(final.text, /bring the energy|Keep that rhythm/);
 assert.match(halfway.text, /3 minutes remaining/);
});

test('repeated generated encouragement falls back to fresh wording', async () => {
 const { composeCommentary } = await import('../lib/commentary');
 const context = commentaryContext('halfway', vacuum, 180, 1);
 const result = composeCommentary(context, 'Let’s bring the energy and make this place shine!', ['Par is six minutes. Let’s bring the energy and make this place shine!']);
 assert.equal(result.generated, false);
 assert.doesNotMatch(result.text, /bring the energy/);
});
