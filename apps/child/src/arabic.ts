const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** 3 → "٣" — western digits rendered as Arabic-Indic numerals in the child UI. */
export function toArabicIndic(value: number): string {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

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

/** Count + noun with Arabic singular/dual/plural agreement: 1 رحلة واحدة، 2 رحلتان، ٣ رحلات، ١١ رحلة. */
export function arabicCount(count: number, forms: ArabicNounForms): string {
  if (count === 1) {
    return forms.one;
  }
  if (count === 2) {
    return forms.two;
  }
  const lastTwo = count % 100;
  const noun = lastTwo >= 3 && lastTwo <= 10 ? forms.few : forms.many;
  return `${toArabicIndic(count)} ${noun}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Friendly calendar-day distance: اليوم / أمس / منذ يومين / منذ ٣ أيام / منذ ١٢ يومًا. */
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
    return `منذ ${toArabicIndic(days)} أيام`;
  }
  return `منذ ${toArabicIndic(days)} يومًا`;
}
