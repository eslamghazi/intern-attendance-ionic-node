import { createParamDecorator } from '@nestjs/common';
export const Lang = createParamDecorator((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    const headers = req.headers || {};
    const customLang = headers['x-language'] || headers['x-lang'];
    if (typeof customLang === 'string') {
        const cl = customLang.trim().toLowerCase();
        if (cl.startsWith('en'))
            return 'en';
        if (cl.startsWith('ar'))
            return 'ar';
    }
    const accept = headers['accept-language'];
    if (typeof accept === 'string') {
        const parts = accept.split(',').map((p) => p.trim());
        for (const part of parts) {
            const code = part.split(';')[0]?.trim().toLowerCase() ?? '';
            if (code.startsWith('en'))
                return 'en';
            if (code.startsWith('ar'))
                return 'ar';
        }
    }
    if (typeof req.query?.lang === 'string') {
        const ql = req.query.lang.trim().toLowerCase();
        if (ql.startsWith('en'))
            return 'en';
        if (ql.startsWith('ar'))
            return 'ar';
    }
    return 'ar';
});
//# sourceMappingURL=lang.decorator.js.map