/**
 * Key used to detect the same company typed in different ways
 * ("Google India Pvt. Ltd." / "google india private limited" / "GOOGLE  INDIA").
 */
export function companyNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(private|pvt)\b\.?/g, ' ')
    .replace(/\b(limited|ltd)\b\.?/g, ' ')
    .replace(/\b(llp|inc|corp|corporation|co)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Collapse whitespace so stored names stay tidy. */
export function cleanCompanyName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}
