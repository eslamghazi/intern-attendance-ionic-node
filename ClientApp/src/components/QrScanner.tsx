import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon, IonSpinner, IonText } from '@ionic/react';
import { imageOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { startQrScan, scanQrFile, type QrScanHandle } from '../lib/camera/qrScanner';

const ELEMENT_ID = 'qr-reader';

/** Camera QR reader — calls onScan with the decoded text once, then stops.
 *  All camera handling lives in lib/camera/qrScanner; this only owns the sized
 *  container and defers the start until it has actually been laid out (starting
 *  inside an animating modal before layout is a classic black-camera cause).
 *  Also offers "read the code from an image" for when the live camera can't get
 *  a clean read (glare, a code shown on a screen, a photo they were sent). */
export default function QrScanner({
  onScan,
  onError,
  allowImage = false,
}: {
  onScan: (text: string) => void;
  onError?: () => void;
  /** Offer "read the code from an image" (admin setting qr_allow_image). */
  allowImage?: boolean;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState(false);

  useEffect(() => {
    let handle: QrScanHandle | null = null;
    let cancelled = false;

    const waitForLayout = async () => {
      for (let i = 0; i < 40 && !cancelled; i++) {
        if ((containerRef.current?.clientWidth ?? 0) > 0) return;
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
    };

    (async () => {
      await waitForLayout();
      if (cancelled) return;
      handle = await startQrScan({
        elementId: ELEMENT_ID,
        onScan,
        onError: () => onError?.(),
      });
    })();

    return () => {
      cancelled = true;
      void handle?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setFileError(false);
    setReading(true);
    try {
      const text = await scanQrFile(file);
      if (text) onScan(text);
      else setFileError(true);
    } finally {
      setReading(false);
      // Allow re-picking the SAME file after a failed read.
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <div id={ELEMENT_ID} ref={containerRef} className="qr-reader" />
      {allowImage && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void pickImage(e.target.files?.[0])}
          />
          <IonButton
            expand="block"
            fill="outline"
            className="ion-margin-top"
            disabled={reading}
            onClick={() => fileRef.current?.click()}
          >
            {reading ? <IonSpinner name="dots" /> : <IonIcon slot="start" icon={imageOutline} />}
            {t('checkin.qrFromImage')}
          </IonButton>
          {fileError && (
            <IonText color="danger">
              <p className="ui-caption" style={{ textAlign: 'center' }}>
                {t('checkin.qrImageNoCode')}
              </p>
            </IonText>
          )}
        </>
      )}
    </>
  );
}
