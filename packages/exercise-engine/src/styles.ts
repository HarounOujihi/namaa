import type { CSSProperties } from "react";

/**
 * Inline-style theme (no CSS framework, no external stylesheet): the engine
 * renders fully self-contained, mirroring the child app's warm palette.
 */
export const COLORS = {
  ink: "#341a0a",
  inkSoft: "#5d4037",
  card: "#ffffff",
  border: "#f0d9c8",
  primary: "#d84315",
  primaryShadow: "#a52a0a",
  secondary: "#00695c",
  secondaryShadow: "#00463c",
  accent: "#ffb300",
  accentSoft: "#fff3e0",
  selectedSoft: "#ffe0b2",
  selectedBorder: "#ef6c00",
} as const;

export const playerRoot: CSSProperties = {
  direction: "rtl",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 16,
  width: "100%",
  fontFamily: "inherit",
  color: COLORS.ink,
};

export const stack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  width: "100%",
};

export const card: CSSProperties = {
  background: COLORS.card,
  border: `3px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: "18px 16px",
};

export const promptCard: CSSProperties = {
  ...card,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
};

export const promptText: CSSProperties = {
  margin: 0,
  fontSize: "1.7rem",
  fontWeight: 800,
  lineHeight: 1.7,
  textAlign: "center",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
};

export const instructionText: CSSProperties = {
  margin: 0,
  fontSize: "1.3rem",
  fontWeight: 700,
  color: COLORS.inkSoft,
  textAlign: "center",
};

export const optionGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 14,
  width: "100%",
};

export const optionButton: CSSProperties = {
  minHeight: 88,
  padding: "14px 12px",
  borderRadius: 22,
  background: COLORS.card,
  border: `3px solid ${COLORS.border}`,
  color: COLORS.ink,
  fontFamily: "inherit",
  fontSize: "2.1rem",
  fontWeight: 800,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
};

export const optionButtonDisabled: CSSProperties = {
  ...optionButton,
  opacity: 0.55,
  cursor: "default",
};

export const optionImage: CSSProperties = {
  width: "100%",
  height: 110,
  objectFit: "contain",
  borderRadius: 14,
};

export const promptImage: CSSProperties = {
  maxWidth: "100%",
  maxHeight: 210,
  objectFit: "contain",
  borderRadius: 18,
};

export const playButton: CSSProperties = {
  width: 84,
  height: 84,
  borderRadius: "50%",
  background: COLORS.secondary,
  border: "none",
  color: "#ffffff",
  fontFamily: "inherit",
  fontSize: "2.4rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

export const primaryButton: CSSProperties = {
  minHeight: 72,
  padding: "12px 32px",
  borderRadius: 24,
  background: COLORS.primary,
  border: "none",
  color: "#ffffff",
  fontFamily: "inherit",
  fontSize: "1.6rem",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: `0 5px 0 ${COLORS.primaryShadow}`,
};

export const primaryButtonDisabled: CSSProperties = {
  ...primaryButton,
  opacity: 0.5,
  cursor: "default",
  boxShadow: "none",
};

export const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: COLORS.secondary,
  boxShadow: `0 5px 0 ${COLORS.secondaryShadow}`,
};

export const secondaryButtonDisabled: CSSProperties = {
  ...secondaryButton,
  opacity: 0.5,
  cursor: "default",
  boxShadow: "none",
};

export const answerRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 14,
  width: "100%",
};

export const phonemeChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 72,
  minHeight: 64,
  padding: "4px 20px",
  borderRadius: 18,
  background: COLORS.accentSoft,
  border: `3px solid ${COLORS.accent}`,
  color: COLORS.ink,
  fontSize: "2rem",
  fontWeight: 900,
};

export const sequenceGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))",
  gap: 14,
  width: "100%",
};

export const sequenceCard: CSSProperties = {
  position: "relative",
  minHeight: 104,
  padding: "12px 8px",
  borderRadius: 20,
  background: COLORS.card,
  border: `3px solid ${COLORS.border}`,
  color: COLORS.ink,
  fontFamily: "inherit",
  fontSize: "1.9rem",
  fontWeight: 800,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
};

export const sequenceCardSelected: CSSProperties = {
  ...sequenceCard,
  background: COLORS.selectedSoft,
  borderColor: COLORS.selectedBorder,
};

export const sequenceCardText: CSSProperties = {
  lineHeight: 1.6,
  overflowWrap: "anywhere",
};

export const sequenceCardBack: CSSProperties = {
  fontSize: "2rem",
  color: COLORS.inkSoft,
};

export const positionBadge: CSSProperties = {
  position: "absolute",
  top: -12,
  insetInlineStart: -10,
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: COLORS.secondary,
  border: "3px solid #ffffff",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.15rem",
  fontWeight: 900,
};

export const pairRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 14,
  width: "100%",
};

export const wordCard: CSSProperties = {
  ...card,
  flex: "1 1 220px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};

export const wordText: CSSProperties = {
  margin: 0,
  fontSize: "2rem",
  fontWeight: 900,
};

export const slotsRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 10,
  width: "100%",
};

export const slotTile: CSSProperties = {
  minHeight: 76,
  minWidth: 68,
  padding: "10px 14px",
  borderRadius: 18,
  background: COLORS.accentSoft,
  border: `3px dashed ${COLORS.accent}`,
  color: COLORS.ink,
  fontFamily: "inherit",
  fontSize: "1.8rem",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const poolGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))",
  gap: 12,
  width: "100%",
};

export const poolTile: CSSProperties = {
  ...slotTile,
  background: COLORS.card,
  border: `3px solid ${COLORS.border}`,
  cursor: "pointer",
};

export const poolTileUsed: CSSProperties = {
  ...poolTile,
  opacity: 0.25,
  borderStyle: "dashed",
  cursor: "default",
};
