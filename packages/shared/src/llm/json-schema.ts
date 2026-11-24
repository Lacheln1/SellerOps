import { z } from 'zod';

/** zod 스키마를 CLI의 --json-schema에 넘길 순수 JSON Schema로 바꾼다. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}
