import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ title, onClose, children }: DialogProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Escape closes; focus starts on the close button so keyboard users land
  // somewhere sane instead of behind the overlay.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="dialog-backdrop" onClick={handleBackdropClick}>
      <section className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog-header">
          <h2 className="dialog-title">{title}</h2>
          <button ref={closeRef} type="button" className="dialog-close" aria-label="إغلاق" onClick={onClose}>
            ✕
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
