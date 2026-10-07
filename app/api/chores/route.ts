import { getChores } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function GET() { try { return Response.json({ chores: await getChores() }); } catch { return Response.json({ error: 'Could not load chores. Check database setup.' }, { status: 503 }); } }
