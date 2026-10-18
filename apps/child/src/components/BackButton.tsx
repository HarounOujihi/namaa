interface BackButtonProps {
  onClick: () => void;
}

/** The one back control every screen uses: a round 44px arrow at the RTL start of the header. */
export function BackButton({ onClick }: BackButtonProps) {
  return (
    <button type="button" className="back-button" aria-label="رجوع" onClick={onClick}>
      <span aria-hidden="true">→</span>
    </button>
  );
}
