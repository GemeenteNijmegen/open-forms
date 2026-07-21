import { MappingError } from '../errors/ErrorTypes';

export interface ChoiceFieldContext {
  reference: string;
  fieldName: string;
}

/**
 * Maps an optional objecttype choice value (a free string) to a Tribe record
 * reference.
 * - empty/null/undefined -> undefined, so the caller omits the property entirely;
 * - known value -> `{ ID: <record-id> }`, the payload shape Tribe expects for choice fields;
 * - unknown, non-empty value -> terminal MappingError, no silent fallback.
 */
export function mapChoiceField(
  value: string | null | undefined,
  idsByValue: Record<string, string>,
  context: ChoiceFieldContext,
): { ID: string } | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const id = idsByValue[value];
  if (!id) {
    throw new MappingError(`Unknown choice value for field "${context.fieldName}" (reference ${context.reference})`);
  }
  return { ID: id };
}
