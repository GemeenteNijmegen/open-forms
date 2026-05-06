import { z } from 'zod';
import { CostCalculationInput, WatWiltUDoen } from './costCalculation';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_WAT_WILT_U_DOEN = [
  'gemeentegrond',
  'priveterrein',
  'concerten',
  'winter',
  'koningsdag',
] as const satisfies WatWiltUDoen[];

// Accepts HH:MM and HH:MM:SS
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TimeSchema = z
  .string()
  .regex(TIME_REGEX, 'Expected HH:MM or HH:MM:SS format (00:00–23:59)');

const DateSchema = z
  .string()
  .date('Expected ISO 8601 format (YYYY-MM-DD)')
  .transform((val) => new Date(val));

const WatWiltUDoenSchema = z.enum(VALID_WAT_WILT_U_DOEN, {
  message: `Allowed values: ${VALID_WAT_WILT_U_DOEN.join(', ')}`,
});

const ParamsSchema = z
  .object({
    watWiltUDoen: WatWiltUDoenSchema,
    startdatum: DateSchema.optional(),
    einddatum: DateSchema.optional(),
    tijdStartConcerten: TimeSchema.optional(),
    tijdEindeConcerten: TimeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const requiresDates =
      data.watWiltUDoen === 'gemeentegrond' ||
      data.watWiltUDoen === 'priveterrein';

    if (requiresDates) {
      if (!data.startdatum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startdatum'],
          message: 'startdatum is required for gemeentegrond and priveterrein',
        });
      }
      if (!data.einddatum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['einddatum'],
          message: 'einddatum is required for gemeentegrond and priveterrein',
        });
      }
      if (
        data.startdatum &&
        data.einddatum &&
        data.einddatum <= data.startdatum
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['einddatum'],
          message: 'einddatum must be after startdatum',
        });
      }
    }

    if (data.watWiltUDoen === 'concerten') {
      if (!data.tijdStartConcerten) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tijdStartConcerten'],
          message: 'tijdStartConcerten is required for concerten',
        });
      }
      if (!data.tijdEindeConcerten) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tijdEindeConcerten'],
          message: 'tijdEindeConcerten is required for concerten',
        });
      }
    }
  });

const RawEventSchema = z.object({
  queryStringParameters: z.record(z.string()).optional().nullable(),
  body: z.string().optional().nullable(),
  isBase64Encoded: z.boolean().optional().default(false),
});

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(
      issues
        .map((i) => `[${i.path.join('.') || 'root'}] ${i.message}`)
        .join('; '),
    );
    this.name = 'ParseError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeAndParseBody(
  body: string | null | undefined,
  isBase64Encoded: boolean,
): Record<string, unknown> {
  if (!body) return {};

  const decoded = isBase64Encoded
    ? Buffer.from(body, 'base64').toString('utf-8')
    : body;

  try {
    const parsed: unknown = JSON.parse(decoded);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Non-JSON body: discard silently
  }

  return {};
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseEvent(rawEvent: unknown): CostCalculationInput {
  // 1. Validate event envelope shape
  const eventResult = RawEventSchema.safeParse(rawEvent);
  if (!eventResult.success) {
    throw new ParseError(eventResult.error.issues);
  }

  const { queryStringParameters, body, isBase64Encoded } = eventResult.data;

  // 2. Decode base64 if needed, then parse JSON body
  const bodyParams = decodeAndParseBody(body, isBase64Encoded);

  // 3. Merge: body fields take precedence over query string fields
  const merged = {
    ...queryStringParameters,
    ...bodyParams,
  };

  // 4. Validate and transform merged params
  const paramsResult = ParamsSchema.safeParse(merged);
  if (!paramsResult.success) {
    throw new ParseError(paramsResult.error.issues);
  }

  return paramsResult.data;
}
