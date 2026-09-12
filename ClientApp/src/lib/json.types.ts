// What comes off the wire.
//
// WHY THIS AND NOT `unknown`
//
// `unknown` says "I do not know what this is", which is true of a value read
// off an HTTP response — but it is not the whole truth. It came back as JSON,
// so it is a string, a number, a boolean, null, an array of those, or an object
// of those. Nothing else can survive the trip.
//
// It also keeps the values USABLE: `unknown` has to be cast before anything can
// be read from it, and every cast is a place to assert the wrong shape. A
// JsonValue narrows with an ordinary `typeof` check.
//
// The server declares the same three types in server/src/common/json.types.ts.
// They describe the same bytes from the two ends.

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };
