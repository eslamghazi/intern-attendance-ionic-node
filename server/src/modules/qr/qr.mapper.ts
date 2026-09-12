import { MintQrResponseDto, RedeemQrResponseDto } from './dto/qr.dto.js';

export class QrMapper {
  static toMintResponse(data: { token: string; date: string; validity_seconds: number }): MintQrResponseDto {
    return {
      ok: true,
      token: data.token,
      date: data.date,
      validity_seconds: data.validity_seconds,
    };
  }

  static toRedeemResponse(data: { until?: string | null; minutes: number }): RedeemQrResponseDto {
    return {
      ok: true,
      until: data.until ?? null,
      minutes: data.minutes,
    };
  }
}
