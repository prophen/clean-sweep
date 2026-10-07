import { getProfile } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function GET() { try { return Response.json(await getProfile()); } catch { return Response.json({ error: 'Could not load profile. Check database setup.' }, { status: 503 }); } }
