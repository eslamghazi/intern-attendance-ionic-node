import { CreatePresenceCheckResponseDto } from './dto/presence.dto.js';

export class PresenceMapper {
  static toCreateCheckResponse(data: any): CreatePresenceCheckResponseDto {
    return {
      ok: Boolean(data?.ok),
      check_id: data?.check_id,
      target_count: data?.target_count,
      deadline: data?.deadline,
      skipped: data?.skipped,
    };
  }
}
