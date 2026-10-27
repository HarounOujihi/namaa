/** The grammatical forms an Arabic counted noun takes. */
export interface ArabicNounForms {
  /** 1: "رحلة واحدة" */
  one: string;
  /** 2: "رحلتان" */
  two: string;
  /** 3–10 (after the number): "رحلات" */
  few: string;
  /** 11+ (after the number): "رحلة" */
  many: string;
}

/** Count + noun with Arabic singular/dual/plural agreement: 1 رحلة واحدة، 2 رحلتان، 3 رحلات، 11 رحلة. */
export function arabicCount(count: number, forms: ArabicNounForms): string {
  if (count === 1) {
    return forms.one;
  }
  if (count === 2) {
    return forms.two;
  }
  const lastTwo = count % 100;
  const noun = lastTwo >= 3 && lastTwo <= 10 ? forms.few : forms.many;
  return `${count} ${noun}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Friendly calendar-day distance: اليوم / أمس / منذ يومين / منذ 3 أيام / منذ 12 يومًا. */
export function arabicRelativeDay(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return "";
  }
  const startOf = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.max(0, Math.round((startOf(now) - startOf(then)) / DAY_MS));
  if (days === 0) {
    return "اليوم";
  }
  if (days === 1) {
    return "أمس";
  }
  if (days === 2) {
    return "منذ يومين";
  }
  if (days <= 10) {
    return `منذ ${days} أيام`;
  }
  return `منذ ${days} يومًا`;
}
