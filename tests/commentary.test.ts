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
