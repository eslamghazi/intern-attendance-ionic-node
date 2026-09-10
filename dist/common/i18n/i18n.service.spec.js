import { describe, it, expect, beforeEach } from 'vitest';
import { I18nService } from './i18n.service.js';
describe('I18nService', () => {
    let service;
    beforeEach(() => {
        service = new I18nService();
    });
    describe('resolveLanguage', () => {
        it('should default to ar when no input is provided', () => {
            expect(service.resolveLanguage()).toBe('ar');
            expect(service.resolveLanguage(null)).toBe('ar');
            expect(service.resolveLanguage({})).toBe('ar');
        });
        it('should resolve explicit string language', () => {
            expect(service.resolveLanguage('en')).toBe('en');
            expect(service.resolveLanguage('en-US')).toBe('en');
            expect(service.resolveLanguage('ar')).toBe('ar');
            expect(service.resolveLanguage('ar-EG')).toBe('ar');
        });
        it('should resolve from x-language or x-lang header', () => {
            expect(service.resolveLanguage({ 'x-language': 'en' })).toBe('en');
            expect(service.resolveLanguage({ 'x-lang': 'en' })).toBe('en');
            expect(service.resolveLanguage({ 'x-language': 'ar' })).toBe('ar');
        });
        it('should parse Accept-Language header correctly', () => {
            expect(service.resolveLanguage({ 'accept-language': 'en-US,en;q=0.9,ar;q=0.8' })).toBe('en');
            expect(service.resolveLanguage({ 'accept-language': 'ar-EG,ar;q=0.9,en;q=0.8' })).toBe('ar');
        });
    });
    describe('translate', () => {
        it('should translate common keys into Arabic by default', () => {
            expect(service.translate('not_found', 'ar')).toBe('العنصر المطلوب غير موجود');
            expect(service.translate('unauthorized', 'ar')).toBe('غير مصرح لك بالوصول، يرجى تسجيل الدخول');
            expect(service.translate('forbidden', 'ar')).toBe('ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء');
        });
        it('should translate common keys into English', () => {
            expect(service.translate('not_found', 'en')).toBe('Requested resource not found');
            expect(service.translate('unauthorized', 'en')).toBe('Unauthorized access, please sign in');
            expect(service.translate('forbidden', 'en')).toBe('You do not have permission to perform this action');
        });
        it('should translate domain-specific error codes (attendance, face, auth)', () => {
            expect(service.translate('invalid_credentials', 'ar')).toBe('الرقم القومي أو كلمة المرور غير صحيحة');
            expect(service.translate('invalid_credentials', 'en')).toBe('Invalid national ID or password');
            expect(service.translate('mock_location_detected', 'ar')).toBe('تم اكتشاف استخدام تطبيق موقع وهمي، تم رفض التسجيل');
            expect(service.translate('mock_location_detected', 'en')).toBe('Mock location detected, check-in refused');
            expect(service.translate('face_mismatch', 'ar')).toBe('بصمة الوجه غير مطابقة، يرجى إعادة المحاولة في إضاءة مناسبة');
            expect(service.translate('face_mismatch', 'en')).toBe('Biometric face verification failed, please retry in good lighting');
        });
        it('should support dotted keys', () => {
            expect(service.translate('auth.login_success', 'ar')).toBe('تم تسجيل الدخول بنجاح');
            expect(service.translate('auth.login_success', 'en')).toBe('Signed in successfully');
        });
        it('should return raw key if no translation is found', () => {
            expect(service.translate('unknown_non_existent_key', 'en')).toBe('unknown_non_existent_key');
        });
    });
});
//# sourceMappingURL=i18n.service.spec.js.map