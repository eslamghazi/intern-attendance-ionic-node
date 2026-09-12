// The shapes Drizzle hands back, named.
//
// Every repository in this codebase used to spell its own out:
//
//   GenericRepository<typeof members.$inferSelect, string,
//                     typeof members.$inferInsert,
//                     Partial<typeof members.$inferInsert>>
//
// — four type arguments, three of them mechanically derivable from the first.
// Written by hand thirteen times, they were also wrong thirteen times over: a
// repository could be handed one table and typed against another, and nothing
// would say so. Derived from the table, they cannot disagree with it.
export {};
//# sourceMappingURL=row.types.js.map