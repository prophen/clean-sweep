'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowLeft, ArrowRight, Zap, Flame, Trophy, Timer, Sparkles, Utensils, Shirt, Bath, Wind, Volume2, VolumeX, Radio, Lock, Check, Flag, RotateCcw, Headphones } from 'lucide-react';
import { formatTime, thresholdFor, type Chore, type Profile, type Persona, type Run, scoreRun, initialProfile } from '@/lib/game';
import { fallback, finishEvent, type Event } from '@/lib/commentary';
type Result = ReturnType<typeof scoreRun> & { run: Run };
type Voice = Omit<Persona, 'system_prompt'> & { unlocked: boolean };
type Caption = { text: string; time: number };
const icons = { sparkles: Sparkles, utensils: Utensils, shirt: Shirt, bath: Bath, wind: Wind };
async function json(url: string, body?: unknown) { const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Something went wrong. Try again.'); return data; }
export default function Home() {
 const [screen, setScreen] = useState<'home'|'run'|'results'|'personas'>('home');
 const [chores, setChores] = useState<Chore[]>([]);
 const [profile, setProfile] = useState<Profile>(initialProfile);
 const [voices, setVoices] = useState<Voice[]>([]);
 const [persona, setPersona] = useState('hype');
 const [storage, setStorage] = useState('');
 const [loaded, setLoaded] = useState(false);
 const [error, setError] = useState('');
 const [selected, setSelected] = useState<Chore | null>(null);
 const [elapsed, setElapsed] = useState(0);
 const [countdown, setCountdown] = useState<number | null>(null);
 const [starting, setStarting] = useState(false);
 const [saving, setSaving] = useState(false);
 const [muted, setMuted] = useState(false);
 const [audioStatus, setAudioStatus] = useState('Captions ready');
 const [captions, setCaptions] = useState<Caption[]>([]);
 const [result, setResult] = useState<Result | null>(null);
 const [abandon, setAbandon] = useState(false);
 const running = useRef(false);
 const startedAt = useRef(0);
 const runId = useRef('');
 const frozenDuration = useRef<number | null>(null);
 const epoch = useRef(0);
 const fired = useRef(new Set<Event>());
 const muteRef = useRef(false);
 const audioContext = useRef<AudioContext | null>(null);
 const source = useRef<AudioBufferSourceNode | null>(null);
 const audioQueue = useRef(Promise.resolve());
 const wake = useRef<WakeLockSentinel | null>(null);
 const selectedRef = useRef<Chore | null>(null);
 const personaRef = useRef('hype');
 const profileRef = useRef(profile);
 profileRef.current = profile;
 const load = useCallback(async () => { try { const [c,p] = await Promise.all([json('/api/chores'), json('/api/profile')]); setChores(c.chores); setProfile(p.profile); setVoices(p.personas); setStorage(p.storage); setLoaded(true); setError(''); } catch(e) { setError((e as Error).message); } }, []);
 useEffect(() => { void load(); const stored = localStorage.getItem('clean-sweep-persona'); if(stored) { setPersona(stored); personaRef.current=stored; } }, [load]);
 useEffect(() => { if (loaded && !voices.some(v => v.id===persona && v.unlocked)) { setPersona('hype'); personaRef.current='hype'; } }, [loaded, voices, persona]);
 const releaseWake = useCallback(() => { void wake.current?.release().catch(() => {}); wake.current = null; }, []);
 const acquireWake = useCallback(async () => { try { if ('wakeLock' in navigator && !wake.current) wake.current = await navigator.wakeLock.request('screen'); } catch { /* Unsupported wake lock does not prevent play. */ } }, []);
 useEffect(() => { const visible = () => { if(document.visibilityState === 'visible' && running.current) void acquireWake(); }; document.addEventListener('visibilitychange', visible); return () => { document.removeEventListener('visibilitychange',visible); releaseWake(); source.current?.stop(); void audioContext.current?.close(); }; }, [acquireWake, releaseWake]);
 async function playAudio(url: string, version: number) {
 if(muteRef.current || version!==epoch.current || !audioContext.current) return;
 try { const bytes = Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0)); const buffer = await audioContext.current.decodeAudioData(bytes.buffer); if(muteRef.current || version!==epoch.current) return; const s = audioContext.current.createBufferSource(); s.buffer = buffer; s.connect(audioContext.current.destination); source.current=s; await new Promise<void>(resolve => { s.onended=()=>resolve(); s.start(); }); setAudioStatus('Voice connected'); } catch { setAudioStatus('Captions only · audio unavailable'); }
 }
 function announce(event: Event, time: number, prior?: number | null) {
 const chore = selectedRef.current; if (!chore) return Promise.resolve();
 const version = epoch.current;
 const currentPersona = personaRef.current;
 const task = audioQueue.current.catch(()=>{}).then(async () => {
 if(version!==epoch.current) return;
 let line = fallback(event,{...chore,best_seconds:prior===undefined?chore.best_seconds:prior},time,profileRef.current.current_streak_days,currentPersona);
 let audio: string | null = null;
 try { const data = await json('/api/commentary',{event,chore_id:chore.id,persona_id:currentPersona,elapsed:time,previous_best:prior,audio:!muteRef.current}); line=data.text; audio=data.audio_url; } catch { /* Local line is always available. */ }
 if(version!==epoch.current) return;
 setCaptions(c=>[...c,{text:line,time}]);
 if(audio && !muteRef.current) await playAudio(audio,version); else setAudioStatus(muteRef.current?'Voice muted':'Captions only · voice not connected');
 }); audioQueue.current=task; return task;
 }
 useEffect(() => {
 if(screen!=='run' || starting || countdown!==null || saving || frozenDuration.current!==null) return;
 const tick = () => {
 if(!running.current || !selectedRef.current) return;
 const seconds = Math.floor((Date.now()-startedAt.current)/1000); setElapsed(seconds);
 const par = selectedRef.current.par_seconds;
 for(const [event, trigger] of [['halfway',par/2],['final_push',par-30]] as [Event,number][]) if(seconds>=trigger && !fired.current.has(event)) { fired.current.add(event); void announce(event,seconds); }
 };
 tick(); const id=setInterval(tick,200); return ()=>clearInterval(id);
 // Event context comes from refs to avoid restarting the timer on caption updates.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[screen,starting,countdown,saving]);
 async function start(chore: Chore) {
 epoch.current++; source.current?.stop(); audioQueue.current=Promise.resolve();
 try { audioContext.current ??= new AudioContext(); await audioContext.current.resume(); } catch { setAudioStatus('Captions only'); }
 selectedRef.current=chore; setSelected(chore); setScreen('run'); setElapsed(0); setCaptions([]); setResult(null); setError(''); setAbandon(false); frozenDuration.current=null; fired.current=new Set(); runId.current=crypto.randomUUID(); setStarting(true);
 const version=epoch.current;
 await announce('run_start',0);
 if(version!==epoch.current) return;
 setStarting(false); setCountdown(3);
 }
 useEffect(()=> {
 if(countdown===null) return;
 const id=setTimeout(()=> { if(countdown>1) setCountdown(countdown-1); else { setCountdown(null); startedAt.current=Date.now(); running.current=true; void acquireWake(); const streak=profileRef.current.current_streak_days; if([3,7,14,30].includes(streak)) void announce('streak_milestone',0); } },1000);
 return ()=>clearTimeout(id);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[countdown,acquireWake]);
 async function finish() {
 if(saving || !selected) return;
 const duration=frozenDuration.current ?? Math.max(1,Math.floor((Date.now()-startedAt.current)/1000)); frozenDuration.current=duration; running.current=false; setElapsed(duration); setSaving(true); releaseWake(); epoch.current++; source.current?.stop(); audioQueue.current=Promise.resolve();
 try { const data: Result=await json('/api/runs/finish',{chore_id:selected.id,duration_seconds:duration,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,request_id:runId.current}); setResult(data); setProfile(data.profile); setScreen('results'); setCaptions([]); setError(''); void announce(finishEvent(data.first_run,data.beat_pb),duration,data.previous_best); void load(); } catch(e) { setError((e as Error).message); } finally { setSaving(false); }
 }
 function mute() { const value=!muted; setMuted(value); muteRef.current=value; if(value) source.current?.stop(); }
 function goHome() { epoch.current++; source.current?.stop(); running.current=false; releaseWake(); setScreen('home'); setError(''); setAbandon(false); setCountdown(null); }
 const active=voices.find(v=>v.id===persona);
 const progress=(profile.total_xp-thresholdFor(profile.level))/(thresholdFor(profile.level+1)-thresholdFor(profile.level))*100;
 const live=screen==='run';
 const target=selected?.best_seconds ?? selected?.par_seconds ?? 0;
 const behind=elapsed>=target;
 return <div className="app-shell">
 <header className="site-header"><button className="brand" onClick={()=>{ if(live) setAbandon(true); else goHome(); }} aria-label="Clean Sweep home"><span className="brand-mark"><Zap size={22} fill="currentColor"/></span>clean sweep<span className="brand-dot">.</span></button><span className="header-tag">LESS MESS. MORE GLORY.</span><button className="voice-shortcut" aria-label={live ? (muted ? "Unmute commentary" : "Mute commentary") : "Choose commentator"} onClick={()=>{ if(!live) setScreen(screen==='personas'?'home':'personas'); else mute(); }}><Headphones size={16}/><span>{live?(muted?'Muted':'Sound on'):'The commentary booth'}</span><ArrowUpRight size={14}/></button></header>
 <main>
 {error && <div className="error" role="alert">{error} {!loaded && <button onClick={()=>void load()}>Retry</button>}</div>}
 {screen==='home' && <>
 <section className="hero"><div className="eyebrow"><span className="live-dot"/> CHORES, BUT MAKE IT COMPETITIVE</div><h1>Your home.<br/>Your <span>arena.</span></h1><p>Beat the mess. Chase your best.<br/>Let your commentator call the action.</p><div className="hero-decoration" aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><Zap className="hero-bolt" fill="currentColor"/><span className="deco-caption">THE CLEANER<br/>TAKES IT ALL.</span><span className="deco-star">✳</span></div></section>
 <section className="profile-strip" aria-label="Player progress"><div className="player-level"><span className="level-icon"><Zap size={22}/></span><div><small>LOOKING SHARP, {profile.display_name.toUpperCase()}</small><strong>Level {profile.level} <span>· {profile.level<3?'Rising rookie':'Household hero'}</span></strong></div></div><div className="xp-wrap"><div><span>{profile.total_xp} XP</span><span>{thresholdFor(profile.level+1)} XP · LVL {profile.level+1}</span></div><div className="progress"><i style={{width:`${progress}%`}}/></div></div><div className="streak"><Flame size={24}/><strong>{profile.current_streak_days}</strong><span>DAY STREAK</span></div></section>
 <section className="arenas"><div className="section-heading"><div><span className="eyebrow">PICK YOUR BATTLE</span><h2>Today’s arenas<span> / 05</span></h2></div><span className="heading-note"><Timer size={15}/> A little faster. A little cleaner.</span></div>
 {!loaded ? <div className="loading">Loading your arenas…</div> : <div className="chore-grid">{chores.map((c,i)=>{ const Icon=icons[c.icon as keyof typeof icons] || Sparkles; return <button className={`chore-card card-${i}`} key={c.id} onClick={()=>void start(c)}><div className="card-top"><span className="chore-icon"><Icon size={26}/></span><span className="arena-number">ARENA 0{i+1}</span><ArrowUpRight className="card-arrow" size={21}/></div><span className="room">{c.room}</span><h3>{c.name}</h3><div className="card-stats"><div><small>PAR TIME</small><strong>{formatTime(c.par_seconds)}</strong></div><div><small>PERSONAL BEST</small><strong className={c.best_seconds===null?'no-record':''}>{c.best_seconds===null?'— —':formatTime(c.best_seconds)}</strong></div></div><div className="card-bottom"><span>{c.best_seconds===null?'Your first record starts here':`${c.par_seconds-c.best_seconds>=0?'−':'+'}${formatTime(Math.abs(c.par_seconds-c.best_seconds))} vs par`}</span><span className="start-link">LET’S GO <ArrowRight size={15}/></span></div></button>;})}<button className="booth-card" onClick={()=>setScreen('personas')}><Radio size={30}/><h3>A voice in<br/>your corner.</h3><p>Big hype or quiet confidence.<br/>Find your kind of commentator.</p><span>MEET THE CASTERS <ArrowUpRight size={16}/></span></button></div>}
 </section><div className="home-footer"><span><Flag size={15}/> A clean room is a win. A personal best is a bonus.</span><span>{storage==='local'?'LOCAL PRACTICE':'SOLO LEAGUE'} <span className="live-dot"/></span></div>
 </>}
 {screen==='personas' && <section className="personas-screen"><button className="back" onClick={goHome}><ArrowLeft size={17}/> Back to arenas</button><span className="eyebrow">THE COMMENTARY BOOTH</span><h1>Meet your<br/><span>hype team.</span></h1><p className="intro">Same chores. A whole different energy.</p><div className="persona-grid">{voices.map((v,i)=><button key={v.id} disabled={!v.unlocked} className={`persona-card ${persona===v.id?'chosen':''}`} onClick={()=>{setPersona(v.id);personaRef.current=v.id;localStorage.setItem('clean-sweep-persona',v.id);}}><div className={`persona-avatar avatar-${i}`}><span>{['HC','GW','DS'][i]}</span><Radio size={25}/></div><div className="persona-label">{v.unlocked?'ON THE MIC':`UNLOCK AT LEVEL ${v.unlock_level}`}</div><h3>{v.name}</h3><p>{v.tagline}</p><span className="persona-action">{!v.unlocked?<><Lock size={16}/> Keep chasing wins</>:persona===v.id?<><Check size={16}/> Your commentator</>:<>Select commentator <ArrowRight size={16}/></>}</span></button>)}</div><p className="small-note">Earn XP to unlock new voices. Every finished run gets you closer.</p></section>}
 {screen==='run' && selected && <section className="run-screen"><div className="run-toolbar"><button className="back" onClick={()=>setAbandon(true)}><ArrowLeft size={17}/> Arenas</button><span className="on-air"><span className="live-dot"/> {starting||countdown!==null?'STANDBY':'ON AIR'}</span><button className="mute-button" onClick={mute}>{muted?<VolumeX/>:<Volume2/>}<span>{muted?'Unmute':'Mute'}</span></button></div><div className="run-title"><span className="eyebrow">YOUR NEXT GREAT SPLIT</span><h2>{selected.name}</h2></div><div className="timer-display">{starting?<span className="preparing">Caster warming up…</span>:countdown!==null?<span className="countdown">{countdown}</span>:formatTime(elapsed)}</div><div className={`pace ${behind?'behind':''}`}>{starting||countdown!==null?'READY WHEN YOU ARE':frozenDuration.current!==null?'RUN COMPLETE':behind?'BEHIND':'AHEAD'}<span>{starting||countdown!==null?'The arena is yours':frozenDuration.current!==null?'Save your split below':`OF ${selected.best_seconds===null?'PAR':'YOUR PERSONAL BEST'}`}</span></div><div className="run-targets"><span>PAR <strong>{formatTime(selected.par_seconds)}</strong></span><span>PB <strong>{selected.best_seconds===null?'SET IT TODAY':formatTime(selected.best_seconds)}</strong></span></div><div className="caption-panel"><div className="caption-header"><Radio size={17}/><strong>{active?.name || 'Hype Caster'}</strong><span>{muted?'Muted':audioStatus}</span></div><div className="caption-feed" aria-live="polite">{captions.length?captions.slice(-2).map((c,i)=><p key={`${c.time}-${i}`} className={i===captions.slice(-2).length-1?'latest':''}><span>{formatTime(c.time)}</span>{c.text}</p>):<p className="latest">Your commentator is stepping up to the mic.</p>}</div></div><button className="finish-button" disabled={starting||countdown!==null||saving} onClick={()=>void finish()}>{saving?'SAVING YOUR WIN…':frozenDuration.current!==null?'RETRY SAVE':'FINISH RUN'}<Flag size={25}/></button><p className="small-note">Clean enough to call it? The finish line is yours.</p>{abandon && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="abandon-title"><h2 id="abandon-title">Leave this run?</h2><p>This attempt won’t earn XP or set a record.</p><button className="primary" onClick={goHome}>Leave run</button><button className="secondary" onClick={()=>setAbandon(false)}>Keep going</button></div></div>}</section>}
 {screen==='results' && result && selected && <section className="results-screen"><span className="eyebrow">{selected.name.toUpperCase()} · RUN COMPLETE</span><div className="result-emblem"><Trophy size={42}/></div><span className="result-badge">{result.beat_pb?'NEW PERSONAL BEST':result.first_run?'BASELINE SET':'MESS: DEFEATED'}</span><h1>{result.beat_pb?'That’s a new':'You showed'}<br/><span>{result.beat_pb?'benchmark.':'up. You won.'}</span></h1><div className="result-time">{formatTime(result.run.duration_seconds)}</div><p className="delta">{result.delta===null?'Your first split. Your next rival.':result.delta<0?`${Math.abs(result.delta)} seconds faster than your previous best`:`${result.delta} seconds off your personal best`}</p><div className="results-stats"><div><Zap/><strong>+{result.xp_earned}</strong><small>XP EARNED</small></div><div><Flame/><strong>{result.profile.current_streak_days}</strong><small>DAY STREAK</small></div><div><Trophy/><strong>{formatTime(result.best_seconds)}</strong><small>PERSONAL BEST</small></div></div><div className="xp-breakdown"><span>Finished the job <b>+50 XP</b></span>{result.beat_pb&&<span>New personal best <b>+50 XP</b></span>}{result.xp_breakdown.streak>0&&<span>Showed up today <b>+25 XP</b></span>}<div className="progress"><i style={{width:`${progress}%`}}/></div><small>{result.level_up?`LEVEL UP! You’re now level ${profile.level}. `:`Level ${profile.level} · `}{profile.total_xp} / {thresholdFor(profile.level+1)} XP</small></div>{captions.length>0 && <p className="result-caption" aria-live="polite">“{captions.at(-1)?.text}”</p>}<button className="mute-result" onClick={mute}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>} {muted?'Unmute commentator':'Mute commentator'}</button><button className="primary" onClick={()=>void start({...selected,best_seconds:result.best_seconds})}>RUN IT BACK <RotateCcw size={19}/></button><button className="secondary" onClick={goHome}>Back to arenas <ArrowRight size={16}/></button></section>}
 </main><footer className="site-footer"><span>SMALL CHORES. BIG WINS.</span><span>CLEAN SWEEP © 2026</span></footer>
 </div>;
}
