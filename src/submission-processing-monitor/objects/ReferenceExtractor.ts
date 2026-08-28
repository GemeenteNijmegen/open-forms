import { ESF_OBJECT_TYPE_NAME } from './ObjectProcessingRules';

/**
 * Extracts the human reference from a record's data. Regular submissions carry it directly;
 * ESF taken don't have a plain reference field, so it's reconstructed in the same form the
 * receiver already uses (ObjectParser.ts), without importing or changing that file.
 */
export function extractReference(objectTypeName: string, data: Record<string, unknown>): string | undefined {
  if (objectTypeName === ESF_OBJECT_TYPE_NAME) {
    return extractEsfReference(data);
  }
  return typeof data.reference === 'string' ? data.reference : undefined;
}

function extractEsfReference(data: Record<string, unknown>): string | undefined {
  const formtaak = data.formtaak as Record<string, unknown> | undefined;
  const verzondenData = formtaak?.verzonden_data as Record<string, unknown> | undefined;
  const taakData = formtaak?.data as Record<string, unknown> | undefined;
  const formulierreferentie = verzondenData?.formulierreferentie;
  const dossiernummer = taakData?.dossiernummer;
  const periodenummer = taakData?.periodenummer;

  if (typeof formulierreferentie !== 'string' || typeof dossiernummer !== 'string' || typeof periodenummer !== 'string') {
    return undefined;
  }
  return `ESF-${formulierreferentie}-${dossiernummer}-${periodenummer}`;
}

/**
 * ESF-taak clientnummer, aanwezig in formtaak.data.clientnummer vanaf status open (in
 * tegenstelling tot reference, die pas bestaat zodra verzonden_data verschijnt bij afgerond).
 */
export function extractEsfClientNumber(data: Record<string, unknown>): string | undefined {
  const formtaak = data.formtaak as Record<string, unknown> | undefined;
  const taakData = formtaak?.data as Record<string, unknown> | undefined;
  const clientnummer = taakData?.clientnummer;
  return typeof clientnummer === 'string' ? clientnummer : undefined;
}
