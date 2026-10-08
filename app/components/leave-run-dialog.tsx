'use client';
import { useEffect, useRef } from 'react';

export function LeaveRunDialog({ open, onClose, onLeave }: { open: boolean; onClose: () => void; onLeave: () => void }) {
 const dialog = useRef<HTMLDialogElement>(null);
 const keepGoing = useRef<HTMLButtonElement>(null);
 useEffect(() => {
  const element = dialog.current;
  if (!open || !element) return;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  element.showModal();
  keepGoing.current?.focus();
  return () => {
   element.close();
   if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
 }, [open]);
 return <dialog ref={dialog} className="modal" aria-labelledby="abandon-title" aria-describedby="abandon-description" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
  if (event.key !== 'Tab') return;
  const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
 }}>
  <h2 id="abandon-title">Leave this run?</h2>
  <p id="abandon-description">This attempt won’t earn XP or set a record.</p>
  <button className="primary" onClick={onLeave}>Leave run</button>
  <button ref={keepGoing} className="secondary" onClick={onClose}>Keep going</button>
 </dialog>;
}
