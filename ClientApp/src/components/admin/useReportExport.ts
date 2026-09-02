import { useIonActionSheet, useIonLoading, useIonToast } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { printReport } from '../../lib/printReport';
import { exportExcel } from '../../lib/exportExcel';
import { TOAST_MS } from '../../lib/config';
import { useBranding } from '../../lib/branding';

export interface ReportInput {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
  landscape?: boolean;
  subtitle?: string;
  /** Optional per-cell background (CSS hex) — used to color-code status grids. */
  cellColors?: (string | undefined)[][];
  /** Optional chart images (PNG data URLs) rendered above the table in the PDF. */
  images?: { label: string; dataUrl: string }[];
}

/** Shows an action sheet to export the given report as PDF (print) or Excel. */
export function useReportExport() {
  const { t, i18n } = useTranslation();
  const [present] = useIonActionSheet();
  const [showLoading, dismissLoading] = useIonLoading();
  const [toast] = useIonToast();
  const brand = useBranding();

  return (input: ReportInput) => {
    present({
      header: t('common.exportAs'),
      buttons: [
        {
          text: 'PDF',
          handler: () => {
            printReport(input.title, input.headers, input.rows, {
              rtl: i18n.dir() === 'rtl',
              landscape: input.landscape,
              subtitle: input.subtitle,
              cellColors: input.cellColors,
              images: input.images,
              brand,
            });
            toast({ message: t('common.exported'), duration: TOAST_MS.brief, color: 'success' });
          },
        },
        {
          text: 'Excel',
          handler: async () => {
            await showLoading({ message: t('common.processing') });
            try {
              await exportExcel(input.title, input.headers, input.rows, input.filename, {
                rtl: i18n.dir() === 'rtl',
                cellColors: input.cellColors,
                brand,
              });
              toast({ message: t('common.exported'), duration: TOAST_MS.brief, color: 'success' });
            } catch {
              toast({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
            } finally {
              await dismissLoading();
            }
          },
        },
        { text: t('common.cancel'), role: 'cancel' },
      ],
    });
  };
}
