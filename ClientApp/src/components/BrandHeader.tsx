import { useBranding } from '../lib/branding';

/** Compact organization logo + name, shown at the top of main screens. Renders
 *  nothing until the org has set its own branding (keeps the vendor default out
 *  of the app chrome). */
export default function BrandHeader() {
  const brand = useBranding();
  if (!brand.hasOrg) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        justifyContent: 'center',
        padding: '14px 16px 2px',
      }}
    >
      <img src={brand.logo} alt="" style={{ height: 34, maxWidth: 120, objectFit: 'contain' }} />
      <span style={{ fontWeight: 800, fontSize: '1.02rem' }}>{brand.name}</span>
    </div>
  );
}
