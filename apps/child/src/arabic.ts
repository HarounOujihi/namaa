const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** 3 → "٣" — western digits rendered as Arabic-Indic numerals in the child UI. */
export function toArabicIndic(value: number): string {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}
