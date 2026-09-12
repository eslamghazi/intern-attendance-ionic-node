import { useIonActionSheet, useIonLoading, useIonToast } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { downloadReport, printReportFromServer, type ExportParams } from '../lib/api/exports';
import { TOAST_MS } from '../lib/config';

/**
 * Export a report the SERVER builds — as a spreadsheet, or as a PDF.
 *
 * NOT admin-only, which is why it does not live under components/admin: the
 * member's own attendance history exports through exactly this hook.
 *
 * Both formats come from the same endpoint and the same rows: every record the
 * current filters match, with no page in between. The client's only job is to
 * ask, and to decide where the answer goes.
 *
 *   Excel  the API returns .xlsx and the browser saves it.
 *   PDF    the API returns a print-ready document and the browser prints it,
 *          which is where "Save as PDF" comes from.
 *
 * The PDF is not generated server-side because Arabic needs glyph shaping and
 * bidirectional layout, and no Node PDF library does either — the browser is
 * the only renderer here that gets it right. The REPORT is still the server's:
 * which rows, in what order, with which totals and colours.
 */
export function useServerExport() {
  const { t } = useTranslation();
  const [present] = useIonActionSheet();
  const [showLoading, dismissLoading] = useIonLoading();
  const [toast] = useIonToast();

  return (path: string, params: ExportParams, filename: string) => {
    const fail = (err: unknown) => {
      // A blocked popup is worth naming: "nothing happened" is otherwise
      // indistinguishable from a failed request, and the fix is the user's.
      const blocked = err instanceof Error && err.message === 'popup-blocked';
      toast({
        message: blocked ? t('common.popupBlocked') : t('common.error'),
        duration: TOAST_MS.short,
        color: 'danger',
      });
    };

    present({
      header: t('common.exportAs'),
      buttons: [
        {
          text: 'PDF',
          handler: () => {
            // Deliberately not awaited: the action sheet's handler must return
            // so the sheet closes, and the window has to be opened inside the
            // click for the popup blocker to allow it.
            void (async () => {
              await showLoading({ message: t('common.processing') });
              try {
                await printReportFromServer(path, params);
              } catch (err) {
                fail(err);
              } finally {
                await dismissLoading();
              }
            })();
          },
        },
        {
          text: 'Excel',
          handler: () => {
            void (async () => {
              await showLoading({ message: t('common.processing') });
              try {
                await downloadReport(path, params, `${filename}.xlsx`);
              } catch (err) {
                fail(err);
              } finally {
                await dismissLoading();
              }
            })();
          },
        },
        { text: t('common.cancel'), role: 'cancel' },
      ],
    });
  };
}
