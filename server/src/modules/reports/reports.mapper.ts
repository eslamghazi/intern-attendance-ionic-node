export class ReportsMapper {
  static toPaginated<T>(items: T[], total: number) {
    return {
      items,
      total,
    };
  }
}
