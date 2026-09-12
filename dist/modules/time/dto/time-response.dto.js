var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class ServerNowResponseDto {
    date;
    time;
    frozen;
    real_date;
    real_time;
}
__decorate([
    ApiProperty({ example: '2026-09-10', description: 'Server date in Africa/Cairo (yyyy-MM-dd)' }),
    __metadata("design:type", String)
], ServerNowResponseDto.prototype, "date", void 0);
__decorate([
    ApiProperty({ example: '09:00:00', description: 'Server time in Africa/Cairo (HH:mm:ss)' }),
    __metadata("design:type", String)
], ServerNowResponseDto.prototype, "time", void 0);
__decorate([
    ApiPropertyOptional({ example: false, description: 'Whether the clock is artificially frozen' }),
    __metadata("design:type", Boolean)
], ServerNowResponseDto.prototype, "frozen", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10', description: 'Real system date if frozen' }),
    __metadata("design:type", String)
], ServerNowResponseDto.prototype, "real_date", void 0);
__decorate([
    ApiPropertyOptional({ example: '09:00:00', description: 'Real system time if frozen' }),
    __metadata("design:type", String)
], ServerNowResponseDto.prototype, "real_time", void 0);
//# sourceMappingURL=time-response.dto.js.map