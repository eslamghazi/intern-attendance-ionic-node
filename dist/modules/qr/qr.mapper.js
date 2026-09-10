export class QrMapper {
    static toMintResponse(data) {
        return {
            ok: true,
            token: data.token,
            date: data.date,
            validity_seconds: data.validity_seconds,
        };
    }
    static toRedeemResponse(data) {
        return {
            ok: true,
            until: data.until ?? null,
            minutes: data.minutes,
        };
    }
}
//# sourceMappingURL=qr.mapper.js.map