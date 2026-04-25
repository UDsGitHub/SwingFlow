import { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { Button } from './Button';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  destructive  = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (!open || prefersReducedMotion || !overlayRef.current || !panelRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: 'power2.out' })
        .fromTo(panelRef.current, { autoAlpha: 0, y: 12, scale: 0.98 }, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.28,
          ease: 'power3.out',
          clearProps: 'opacity,transform',
        }, '-=0.08');
    });

    return () => ctx.revert();
  }, [open, prefersReducedMotion]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div ref={panelRef} className="bg-surface-800 rounded-2xl border border-surface-700 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-700">
          <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sf-body text-gray-400 leading-relaxed">{message}</p>
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5 flex-wrap">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
