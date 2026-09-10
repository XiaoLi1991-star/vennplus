import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function WorkspaceDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => { if (dialog.close) dialog.close(); previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className="workspace-dialog" aria-labelledby={titleId}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, a[href], [tabindex]')]
        .filter((node) => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-shell">
      <header className="dialog-heading"><h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" aria-label={`关闭${title}`} onClick={onClose}><X size={20} /></button>
      </header>
      {children}
    </div>
  </dialog>, document.body);
}
