import { LookupFaceResponseDto, TemplatePhotoItemDto } from './dto/face.dto.js';

export class FaceMapper {
  static toLookupResponse(row: any): LookupFaceResponseDto {
    if (!row) {
      return { found: false };
    }
    return {
      found: true,
      member_id: row.member_id,
      member_code: row.member_code ?? null,
      full_name: row.full_name,
      enrolled: Boolean(row.enrolled ?? row.has_face),
    };
  }

  static toPhotoItems(rows: any[]): TemplatePhotoItemDto[] {
    return rows.map((r) => ({
      member_id: r.member_id,
      photo_path: r.photo_path ?? null,
      created_at: r.created_at,
    }));
  }
}
