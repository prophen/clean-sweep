import { getChores, getProfile, getPersonas } from '@/lib/store';
import { events, commentaryContext, commentaryRules, commentaryFacts, flavorRules, composeCommentary, type Event } from '@/lib/commentary';
export async function POST(request: Request) {
 try {
 const body = await request.json();
 if (!events.includes(body.event) || !Number.isInteger(body.elapsed) || body.elapsed < 0 || body.elapsed > 86400) return Response.json({ error: 'Invalid commentary event.' }, { status: 400 });
 const [allChores, data, personas] = await Promise.all([getChores(), getProfile(), getPersonas()]);
 const chore = allChores.find(c => c.id === body.chore_id);
 const persona = personas.find(p => p.id === body.persona_id);
 if (!chore || !persona || persona.unlock_level > data.profile.level) return Response.json({ error: 'Chore or commentator unavailable.' }, { status: 400 });
 // Finish context uses the prior PB so the celebration can describe the improvement.
 if (body.event.startsWith('finish_') && (body.previous_best === null || (Number.isInteger(body.previous_best) && body.previous_best > 0 && body.previous_best <= 86400))) chore.best_seconds = body.previous_best;
 const context = commentaryContext(body.event as Event, chore, body.elapsed, data.profile.current_streak_days);
 let { text, generated } = composeCommentary(context);
 if (process.env.OPENAI_API_KEY) try {
 const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', max_completion_tokens: 120, messages: [{ role: 'system', content: `${persona.system_prompt} ${commentaryRules} ${flavorRules}` }, { role: 'user', content: JSON.stringify({ ...context, factual_line: commentaryFacts(context) }) }] }) });
 if (response.ok) { const output = await response.json(); const line = output.choices?.[0]?.message?.content?.trim(); if (line) { ({ text, generated } = composeCommentary(context, line)); } }
 } catch { /* Deterministic captions keep the event working. */ }
 let audio_url: string | null = null;
 if (process.env.DEEPGRAM_API_KEY && body.audio !== false) try {
 const response = await fetch(`https://api.deepgram.com/v1/speak?model=${persona.voice_id}&encoding=mp3`, { method: 'POST', signal: AbortSignal.timeout(8000), headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
 if (response.ok) audio_url = `data:audio/mpeg;base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
 } catch { /* Voice failure is text-only, never a failed run. */ }
 return Response.json({ text, audio_url, generated });
 } catch { return Response.json({ error: 'Commentary unavailable.' }, { status: 503 }); }
}
