export class RosterMapper {
  static toRosterViewResult(data: { rows: any[]; total: number }): { rows: any[]; total: number } {
    return {
      rows: data.rows,
      total: data.total,
    };
  }
}
