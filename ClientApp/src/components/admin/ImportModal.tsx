import { useMemo, useRef, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonRadio,
  IonRadioGroup,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { checkmarkCircle, cloudUploadOutline, documentOutline, downloadOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import {
  countFor,
  type ImportMode,
  type ImportPrepared,
  type ImportStrategy,
  type ImportSummary,
} from '../../lib/importModes';

type Phase = 'choose' | 'preparing' | 'ready' | 'applying' | 'done';

const MODE_DESC: Record<ImportMode, { label: string; desc: string }> = {
  update: { label: 'import.modeUpdate', desc: 'import.modeUpdateDesc' },
  skip: { label: 'import.modeSkip', desc: 'import.modeSkipDesc' },
  fail: { label: 'import.modeFail', desc: 'import.modeFailDesc' },
};

/** Reusable import dialog: file -> options (conflict mode) -> preview -> apply. */
export default function ImportModal({
  isOpen,
  strategy,
  onClose,
  onApplied,
}: {
  isOpen: boolean;
  strategy: ImportStrategy | null;
  onClose: () => void;
  onApplied?: (summary: ImportSummary) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('choose');
  const [prepared, setPrepared] = useState<ImportPrepared | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<ImportMode>('update');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');
  // Preview table: search + status filter + pagination (files can be huge).
  const [pvSearch, setPvSearch] = useState('');
  const [pvStatus, setPvStatus] = useState<'all' | 'new' | 'update' | 'invalid'>('all');
  const [pvPage, setPvPage] = useState(1);
  const PV_SIZE = 50;

  const reset = () => {
    setPhase('choose');
    setPrepared(null);
    setFileName('');
    setSummary(null);
    setError('');
    setPvSearch('');
    setPvStatus('all');
    setPvPage(1);
  };

  const pvRows = useMemo(() => {
    if (!prepared) return [];
    const q = pvSearch.trim().toLowerCase();
    return prepared.preview
      .map((r, idx) => ({ ...r, n: idx + 1 }))
      .filter(
        (r) =>
          (pvStatus === 'all' || r.status === pvStatus) &&
          (!q ||
            r.cells.some((c) => c.toLowerCase().includes(q)) ||
            (r.error ?? '').toLowerCase().includes(q)),
      );
  }, [prepared, pvSearch, pvStatus]);
  const pvPages = Math.max(1, Math.ceil(pvRows.length / PV_SIZE));
  const pvClamped = Math.min(pvPage, pvPages);
  const pvSlice = pvRows.slice((pvClamped - 1) * PV_SIZE, pvClamped * PV_SIZE);

  const close = () => {
    reset();
    onClose();
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !strategy) return;
    setFileName(file.name);
    setError('');
    setPhase('preparing');
    try {
      const prep = await strategy.prepare(file);
      setPrepared(prep);
      setMode(strategy.defaultMode);
      setPhase('ready');
    } catch {
      setError(t('common.error'));
      setPhase('choose');
    }
  };

  const apply = async () => {
    if (!strategy || !prepared) return;
    setPhase('applying');
    try {
      const res = await strategy.apply(prepared, mode);
      setSummary(res);
      setPhase('done');
      onApplied?.(res);
    } catch {
      setError(t('common.error'));
      setPhase('ready');
    }
  };

  const counts = prepared ? countFor(prepared, mode) : null;
  const nothingToDo = !!counts && counts.create === 0 && counts.update === 0 && counts.skip === 0;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={close}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{strategy ? t(strategy.titleKey) : ''}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={close}>{t('common.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {!strategy ? null : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={strategy.accept}
              hidden
              onChange={onPick}
            />

            {/* Step 1 — choose a file */}
            {(phase === 'choose' || phase === 'preparing') && (
              <div style={{ textAlign: 'center', paddingTop: 12 }}>
                <IonIcon icon={cloudUploadOutline} color="primary" style={{ fontSize: 56 }} />
                <p className="ui-caption">{t('import.chooseHint')}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <IonButton onClick={() => fileRef.current?.click()} disabled={phase === 'preparing'}>
                    <IonIcon slot="start" icon={documentOutline} />
                    {t('import.chooseFile')}
                  </IonButton>
                  {strategy.downloadTemplate && (
                    <IonButton fill="outline" onClick={() => void strategy.downloadTemplate?.()}>
                      <IonIcon slot="start" icon={downloadOutline} />
                      {t('common.template')}
                    </IonButton>
                  )}
                </div>
                {phase === 'preparing' && (
                  <div style={{ marginTop: 16 }}>
                    <IonSpinner name="crescent" />
                    <p className="ui-caption">{t('import.parsing')}</p>
                  </div>
                )}
                {error && (
                  <IonText color="danger">
                    <p>{error}</p>
                  </IonText>
                )}
              </div>
            )}

            {/* Step 2 — options + preview */}
            {(phase === 'ready' || phase === 'applying') && prepared && counts && (
              <>
                <IonText color="medium">
                  <p className="ui-caption" style={{ margin: '0 0 8px' }}>
                    {fileName} · {t('import.parsedRows', { count: counts.total })}
                  </p>
                </IonText>

                <IonList inset>
                  <IonRadioGroup value={mode} onIonChange={(e) => setMode(e.detail.value)}>
                    {strategy.modes.map((m) => (
                      <IonItem key={m}>
                        <IonRadio value={m} justify="start" labelPlacement="end">
                          <IonLabel className="ion-text-wrap">
                            <strong>{t(MODE_DESC[m].label)}</strong>
                            <p className="ui-caption">{t(MODE_DESC[m].desc)}</p>
                          </IonLabel>
                        </IonRadio>
                      </IonItem>
                    ))}
                  </IonRadioGroup>
                </IonList>

                {/* Live preview of what this mode will do */}
                <div className="ui-surface" style={{ padding: 12, borderRadius: 12 }}>
                  <div className="ui-caption" style={{ marginBottom: 6, fontWeight: 700 }}>
                    {t('import.previewTitle')}
                  </div>
                  <PreviewRow label={t('import.previewNew')} value={counts.create} color="success" />
                  {counts.update > 0 && (
                    <PreviewRow label={t('import.previewUpdate')} value={counts.update} color="primary" />
                  )}
                  {counts.skip > 0 && (
                    <PreviewRow label={t('import.previewSkip')} value={counts.skip} color="medium" />
                  )}
                  {counts.conflict > 0 && (
                    <PreviewRow label={t('import.previewConflict')} value={counts.conflict} color="danger" />
                  )}
                  {counts.invalid > 0 && (
                    <PreviewRow label={t('import.previewInvalid')} value={counts.invalid} color="warning" />
                  )}
                </div>

                {prepared.notes.length > 0 && (
                  <IonText color="medium">
                    <ul className="ui-caption" style={{ margin: '10px 0 0', paddingInlineStart: 18 }}>
                      {prepared.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </IonText>
                )}

                {/* Row-by-row preview of the parsed file, with search + status
                    filter + pagination (some files have thousands of rows). */}
                {prepared.preview.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <IonSearchbar
                        className="import-preview-search"
                        style={{ flex: 1, minWidth: 160, padding: 0 }}
                        value={pvSearch}
                        debounce={200}
                        placeholder={t('common.search')}
                        onIonInput={(e) => {
                          setPvSearch(e.detail.value ?? '');
                          setPvPage(1);
                        }}
                      />
                      <IonSelect
                        interface="popover"
                        value={pvStatus}
                        onIonChange={(e) => {
                          setPvStatus(e.detail.value);
                          setPvPage(1);
                        }}
                      >
                        <IonSelectOption value="all">{t('common.all')}</IonSelectOption>
                        <IonSelectOption value="new">{t('import.status_new')}</IonSelectOption>
                        <IonSelectOption value="update">{t('import.status_update')}</IonSelectOption>
                        <IonSelectOption value="invalid">{t('import.status_invalid')}</IonSelectOption>
                      </IonSelect>
                    </div>

                    <div style={{ overflowX: 'auto', marginTop: 6, maxHeight: '46vh', overflowY: 'auto' }}>
                      <table className="import-preview ltr-nums">
                        <thead>
                          <tr>
                            <th>#</th>
                            {strategy.previewColumns.map((c, i) => (
                              <th key={i}>{c}</th>
                            ))}
                            <th>{t('import.colStatus')}</th>
                            <th>{t('import.colError')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pvSlice.map((r) => (
                            <tr key={r.n} className={`imp-${r.status}`}>
                              <td>{r.n}</td>
                              {r.cells.map((c, j) => (
                                <td key={j}>{c}</td>
                              ))}
                              <td>{t(`import.status_${r.status}`)}</td>
                              <td>{r.error ?? ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {pvPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 6 }}>
                        <IonButton size="small" fill="clear" disabled={pvClamped <= 1} onClick={() => setPvPage(pvClamped - 1)}>
                          ‹
                        </IonButton>
                        <span className="ui-caption ltr-nums">
                          {pvClamped} / {pvPages} · {pvRows.length}
                        </span>
                        <IonButton size="small" fill="clear" disabled={pvClamped >= pvPages} onClick={() => setPvPage(pvClamped + 1)}>
                          ›
                        </IonButton>
                      </div>
                    )}
                  </div>
                )}

                {counts.blocked && (
                  <IonText color="danger">
                    <p className="ui-caption">{t('import.blockedMsg', { count: counts.conflict })}</p>
                  </IonText>
                )}
                {!counts.blocked && nothingToDo && (
                  <IonText color="warning">
                    <p className="ui-caption">{t('import.nothingToDo')}</p>
                  </IonText>
                )}
                {error && (
                  <IonText color="danger">
                    <p>{error}</p>
                  </IonText>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <IonButton fill="outline" onClick={reset} disabled={phase === 'applying'}>
                    {t('import.changeFile')}
                  </IonButton>
                  <IonButton
                    expand="block"
                    style={{ flex: 1 }}
                    onClick={apply}
                    disabled={phase === 'applying' || counts.blocked || nothingToDo}
                  >
                    {phase === 'applying' ? <IonSpinner name="crescent" /> : t('import.confirmImport')}
                  </IonButton>
                </div>
              </>
            )}

            {/* Step 3 — result */}
            {phase === 'done' && summary && (
              <div style={{ textAlign: 'center', paddingTop: 12 }}>
                <IonIcon icon={checkmarkCircle} color="success" style={{ fontSize: 56 }} />
                <h2>{t('import.doneTitle')}</h2>
                <div className="ui-surface" style={{ padding: 12, borderRadius: 12, textAlign: 'start' }}>
                  <PreviewRow label={t('import.created')} value={summary.created} color="success" />
                  <PreviewRow label={t('import.updated')} value={summary.updated} color="primary" />
                  <PreviewRow label={t('import.skipped')} value={summary.skipped} color="medium" />
                  {summary.failed > 0 && (
                    <PreviewRow label={t('import.failed')} value={summary.failed} color="danger" />
                  )}
                </div>
                <IonButton expand="block" className="ion-margin-top" onClick={close}>
                  {t('common.done')}
                </IonButton>
              </div>
            )}
          </>
        )}
      </IonContent>
    </IonModal>
  );
}

function PreviewRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span className="ui-caption">{label}</span>
      <IonText color={color}>
        <strong className="ltr-nums">{value}</strong>
      </IonText>
    </div>
  );
}
