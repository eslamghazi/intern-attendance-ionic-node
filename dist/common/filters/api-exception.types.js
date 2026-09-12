// What the exception filter is handed.
//
// `ctx.getRequest()` and `ctx.getResponse()` are generic on purpose — Nest does
// not know which HTTP adapter is underneath — so the type is ours to state. It
// was stated as `any`, which is how `request.url.startsWith` ended up on a
// value that might have been undefined.
export {};
//# sourceMappingURL=api-exception.types.js.map