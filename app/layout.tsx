import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Clean Sweep — Turn chores into wins', description: 'Race your personal best. An AI caster calls the action. A cleaner home is your victory lap.', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'Clean Sweep', statusBarStyle: 'black-translucent' }, icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111515' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
