import { createParamDecorator } from '@nestjs/common';
export const Caller = createParamDecorator((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.caller ?? request.raw?.caller ?? null;
});
export const Claims = createParamDecorator((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.claims ?? request.raw?.claims ?? null;
});
//# sourceMappingURL=caller.decorator.js.map