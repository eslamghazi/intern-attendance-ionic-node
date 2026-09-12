/**
 * A value that can be stored in a `jsonb` column or sent as JSON.
 *
 * WHY THIS AND NOT `unknown`
 *
 * `unknown` says "I do not know what this is", which is true of a value read off
 * the wire and false of one this code is about to write. An audit detail and a
 * bypass snapshot are not arbitrary — they are JSON, which means no functions,
 * no `undefined`, no Date, no circular references. Naming that rules out the
 * shapes that would silently become `null` or throw at `JSON.stringify`.
 *
 * It also keeps the values USABLE: `unknown` has to be cast before anything can
 * be read from it, and every one of those casts is a place the shape can be
 * asserted wrongly.
 */
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** The usual shape of a stored payload: an object, not a bare scalar. */
export type JsonObject = { [key: string]: JsonValue };
