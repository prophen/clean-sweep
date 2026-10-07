import { chores } from '@/lib/game';
import { finishRun } from '@/lib/store';
export async function POST(request: Request) {
 try {
 const body = await request.json();
 if (!chores.some(c => c.id === body.chore_id) || !Number.isInteger(body.duration_seconds) || body.duration_seconds < 1 || body.duration_seconds > 86400 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) return Response.json({ error: 'Invalid run.' }, { status: 400 });
 try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); } catch { return Response.json({ error: 'Invalid timezone.' }, { status: 400 }); }
 return Response.json(await finishRun(body.chore_id, body.duration_seconds, body.timezone || 'UTC', body.request_id));
 } catch { return Response.json({ error: 'Run could not be saved. Please retry.' }, { status: 503 }); }
}
