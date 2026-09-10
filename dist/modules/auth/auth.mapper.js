import { LoginResultDto } from './dto/auth.dto.js';
export class AuthMapper {
    static toLoginResultDto(result) {
        return new LoginResultDto({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            expires_in: result.expires_in,
            token_type: result.token_type,
            role: result.role,
            must_change_password: result.must_change_password,
            profile: result.profile,
        });
    }
}
//# sourceMappingURL=auth.mapper.js.map