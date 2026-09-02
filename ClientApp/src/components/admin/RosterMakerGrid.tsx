import { useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonCheckbox,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { closeOutline, downloadOutline, trashOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { downloadRosterTemplate } from '../../lib/rosterTemplate';
import { useFeedback } from '../ui/useFeedback';
import { useConfirm } from '../ui/useConfirm';

const pad = (n: number) => String(n).padStart(2, '0');

export interface MakerMember {
  id: string;
  code: string;
  name: string;
}
export interface MakerSeedCell {
  member_id: string;
  day: number;
  key: string;
}

/** Presentational roster builder: choose which members to include, paint shifts
 *  on a grid, then export an Excel in the exact format the roster upload accepts. */
export default function RosterMakerGrid({
  members,
  shifts,
  seed,
  year,
  month,
  daysInMonth,
  scopeKey = '',
  selfId,
}: {
  members: MakerMember[];
  shifts: { key: string; name: string }[];
  seed: MakerSeedCell[];
  year: number;
  month: number;
  daysInMonth: number;
  /** Distinguishes stored drafts per context (e.g. admin branch vs member). */
  scopeKey?: string;
  /** When set (member context), a fresh grid starts with ONLY this member
   *  selected — they add the rest themselves — instead of everyone. */
  selfId?: string;
}) {
  const { t } = useTranslation();
  const fb = useFeedback();
  const confirm = useConfirm();
  const dayList = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // In-progress drafts are kept in the browser so the user can close and reopen
  // and continue where they left off — one slot per (scope, year, month).
  const storageKey = `rosterMaker:${scopeKey}:${year}-${pad(month)}`;
  const persist = (d: Record<string, Record<number, string[]>>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(d));
    } catch {
      /* storage unavailable — draft just isn't persisted */
    }
  };
  // setDraft that also saves the new value (used by every user edit).
  const mutate = (updater: (prev: Record<string, Record<number, string[]>>) => Record<string, Record<number, string[]>>) =>
    setDraft((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });

  const [draft, setDraft] = useState<Record<string, Record<number, string[]>>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [brush, setBrush] = useState<string>(''); // shift key or 'ERASER'
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(daysInMonth);
  const [target, setTarget] = useState<string>(''); // '' = all shown, else a member id
  const [pickSearch, setPickSearch] = useState(''); // filters the member picker

  // Seed the draft + default selection whenever the source data changes. A saved
  // in-progress draft (from a previous session) takes precedence over the server
  // seed so the user resumes exactly where they left off.
  useEffect(() => {
    const fromSeed: Record<string, Record<number, string[]>> = {};
    for (const c of seed) {
      if (!c.key) continue;
      (fromSeed[c.member_id] ??= {})[c.day] = [...(fromSeed[c.member_id]?.[c.day] ?? []), c.key];
    }
    let saved: Record<string, Record<number, string[]>> | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    const usingSaved = !!(saved && typeof saved === 'object');
    const d = usingSaved ? saved! : fromSeed;
    setDraft(d);
    // Members that already have cells in the CURRENT data.
    const withData = members
      .filter((m) => d[m.id] && Object.values(d[m.id]).some((v) => v?.length))
      .map((m) => m.id);
    // NEVER select everyone. A resumed draft keeps whoever the user had. A fresh
    // grid: member context → only the logged-in member; admin context → the
    // members who already have roster cells (else none). The rest are added from
    // the searchable list.
    const selfOnly = selfId && members.some((m) => m.id === selfId) ? [selfId] : [];
    let sel: string[];
    if (usingSaved) sel = withData.length ? withData : selfOnly;
    else if (selfId) sel = selfOnly;
    else sel = withData;
    setSelectedIds(sel);
    setBrush(shifts[0]?.key ?? '');
    setFrom(1);
    setTo(daysInMonth);
    setTarget('');
    if (saved) fb.toast(t('rosters.draftRestored'), 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, members, shifts, daysInMonth, storageKey]);

  const shown = useMemo(() => members.filter((m) => selectedIds.includes(m.id)), [members, selectedIds]);

  // Totals mirror the exported sheet: shifts per member for the month, and how
  // many people each day holds.
  const memberTotal = (id: string) =>
    dayList.reduce((sum, d) => sum + (draft[id]?.[d]?.length ?? 0), 0);
  const dayTotal = (d: number) =>
    shown.reduce((sum, m) => sum + (draft[m.id]?.[d]?.length ?? 0), 0);
  const grandTotal = shown.reduce((sum, m) => sum + memberTotal(m.id), 0);
  // Split by shift type as well as combined — "10 shifts" is less useful than
  // "6 morning, 4 night" when you are balancing a roster.
  const memberShiftTotal = (id: string, key: string) =>
    dayList.reduce((sum, d) => sum + (draft[id]?.[d] ?? []).filter((k) => k === key).length, 0);
  const dayShiftTotal = (d: number, key: string) =>
    shown.reduce((sum, m) => sum + (draft[m.id]?.[d] ?? []).filter((k) => k === key).length, 0);
  const shiftGrandTotal = (key: string) =>
    shown.reduce((sum, m) => sum + memberShiftTotal(m.id, key), 0);

  const paint = (mid: string, day: number) => {
    mutate((prev) => {
      const md = { ...(prev[mid] ?? {}) };
      const cur = md[day] ?? [];
      if (brush === 'ERASER' || !brush) md[day] = [];
      else md[day] = cur.includes(brush) ? cur.filter((k) => k !== brush) : [...cur, brush];
      return { ...prev, [mid]: md };
    });
  };

  const applyRange = () => {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const targets = target ? shown.filter((m) => m.id === target) : shown;
    mutate((prev) => {
      const next = { ...prev };
      for (const m of targets) {
        const md = { ...(next[m.id] ?? {}) };
        for (let day = lo; day <= hi; day++) md[day] = brush === 'ERASER' || !brush ? [] : [brush];
        next[m.id] = md;
      }
      return next;
    });
  };

  const clearMember = (mid: string) => mutate((prev) => ({ ...prev, [mid]: {} }));
  // Remove the whole in-progress roster (and its saved copy) — with confirmation.
  const clearAll = async () => {
    const ok = await confirm({
      header: t('rosters.clearAll'),
      message: t('rosters.clearConfirm'),
      confirmText: t('common.clear'),
      danger: true,
    });
    if (!ok) return;
    setDraft({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    fb.toast(t('rosters.draftCleared'), 'success');
  };

  const exportFile = async () => {
    const out = shown
      .filter((m) => m.code)
      .map((m) => ({
        code: m.code,
        full_name: m.name,
        days: Object.fromEntries(
          Object.entries(draft[m.id] ?? {}).map(([d, keys]) => [d, keys.join(' ')]),
        ) as Record<number, string>,
      }));
    if (!out.length) {
      fb.toast(t('common.none'), 'warning');
      return;
    }
    await downloadRosterTemplate({
      year,
      month,
      daysInMonth,
      shifts,
      members: out,
      filename: `roster_${year}_${pad(month)}.xlsx`,
      labels: { code: t('admin.memberCode'), fullName: t('admin.fullName'), total: t('rosters.total') },
    });
    fb.toast(t('common.exported'), 'success');
  };

  return (
    <div>
      <div className="ui-caption" style={{ padding: '10px 14px 4px' }}>{t('rosters.makerHint')}</div>

      {/* Searchable member picker: type to filter, tick to add to the roster. */}
      <div className="ui-caption" style={{ padding: '4px 14px 0' }}>
        {t('rosters.selectMembers')} · {selectedIds.length}/{members.length}
      </div>
      <IonSearchbar
        value={pickSearch}
        debounce={150}
        onIonInput={(e) => setPickSearch(e.detail.value ?? '')}
        placeholder={t('admin.byName')}
      />
      <IonList style={{ maxHeight: 240, overflowY: 'auto', margin: '0 8px' }}>
        {(() => {
          const q = pickSearch.trim().toLowerCase();
          const list = q
            ? members.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
            : members;
          if (list.length === 0)
            return <div className="ui-caption" style={{ padding: 12 }}>{t('attendance.noRecords')}</div>;
          return list.map((m) => (
            <IonItem key={m.id} lines="none">
              <IonCheckbox
                checked={selectedIds.includes(m.id)}
                onIonChange={(e) =>
                  setSelectedIds((prev) =>
                    e.detail.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id),
                  )
                }
                justify="start"
                labelPlacement="end"
              >
                <IonLabel className="ion-text-wrap">
                  {m.name}
                  {m.code ? <span className="ui-caption ltr-nums"> · {m.code}</span> : null}
                </IonLabel>
              </IonCheckbox>
            </IonItem>
          ));
        })()}
      </IonList>

      {/* Brush palette */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px 4px' }}>
        {shifts.map((s) => (
          <IonButton key={s.key} size="small" fill={brush === s.key ? 'solid' : 'outline'} onClick={() => setBrush(s.key)}>
            {s.key} · {s.name}
          </IonButton>
        ))}
        <IonButton size="small" color="medium" fill={brush === 'ERASER' ? 'solid' : 'outline'} onClick={() => setBrush('ERASER')}>
          {t('rosters.eraser')}
        </IonButton>
        <IonButton size="small" color="danger" fill="outline" onClick={clearAll}>
          <IonIcon slot="start" icon={trashOutline} />
          {t('rosters.clearAll')}
        </IonButton>
      </div>

      {/* Bulk apply the brush to a day range for a member or everyone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 10px', flexWrap: 'wrap' }}>
        <IonSelect interface="popover" label={t('rosters.fromDay')} value={from} onIonChange={(e) => setFrom(Number(e.detail.value))} style={{ minWidth: 88 }}>
          {dayList.map((d) => (
            <IonSelectOption key={d} value={d}>
              {d}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonSelect interface="popover" label={t('rosters.toDay')} value={to} onIonChange={(e) => setTo(Number(e.detail.value))} style={{ minWidth: 88 }}>
          {dayList.map((d) => (
            <IonSelectOption key={d} value={d}>
              {d}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonSelect interface="popover" label={t('rosters.applyTo')} value={target} onIonChange={(e) => setTarget(String(e.detail.value))} style={{ minWidth: 120 }}>
          <IonSelectOption value="">{t('common.all')}</IonSelectOption>
          {shown.map((m) => (
            <IonSelectOption key={m.id} value={m.id}>
              {m.name}
            </IonSelectOption>
          ))}
        </IonSelect>
        <IonButton size="small" onClick={applyRange}>
          {t('rosters.applyRange')}
        </IonButton>
      </div>

      {shown.length === 0 ? (
        <div className="ui-caption" style={{ padding: 20, textAlign: 'center' }}>{t('attendance.noRecords')}</div>
      ) : (
        <div style={{ overflowX: 'auto', padding: '0 8px' }}>
          <table className="roster-grid ltr-nums">
            <thead>
              <tr>
                <th className="roster-sticky">{t('rosters.member')}</th>
                {dayList.map((d) => (
                  <th key={d}>{d}</th>
                ))}
                {shifts.map((s) => (
                  <th key={s.key} className="roster-total" title={s.name}>
                    {s.key}
                  </th>
                ))}
                <th className="roster-total">{t('rosters.total')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id}>
                  <td className="roster-sticky">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span>{m.name}</span>
                      <IonButton
                        size="small"
                        fill="clear"
                        color="danger"
                        style={{ margin: 0 }}
                        title={t('common.clear')}
                        onClick={() => clearMember(m.id)}
                      >
                        <IonIcon slot="icon-only" icon={closeOutline} />
                      </IonButton>
                    </div>
                  </td>
                  {dayList.map((d) => {
                    const cell = draft[m.id]?.[d] ?? [];
                    return (
                      <td key={d} className={cell.length ? 'roster-on' : ''} style={{ cursor: 'pointer' }} onClick={() => paint(m.id, d)}>
                        {cell.join(' ')}
                      </td>
                    );
                  })}
                  {shifts.map((s) => (
                    <td key={s.key} className="roster-total">
                      {memberShiftTotal(m.id, s.key)}
                    </td>
                  ))}
                  <td className="roster-total">{memberTotal(m.id)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {shifts.map((s) => (
                <tr key={s.key}>
                  <td className="roster-sticky roster-total">{s.name}</td>
                  {dayList.map((d) => (
                    <td key={d} className="roster-total">
                      {dayShiftTotal(d, s.key)}
                    </td>
                  ))}
                  {shifts.map((other) => (
                    <td key={other.key} className="roster-total">
                      {other.key === s.key ? shiftGrandTotal(s.key) : ''}
                    </td>
                  ))}
                  <td className="roster-total">{shiftGrandTotal(s.key)}</td>
                </tr>
              ))}
              <tr>
                <td className="roster-sticky roster-total">{t('rosters.total')}</td>
                {dayList.map((d) => (
                  <td key={d} className="roster-total">
                    {dayTotal(d)}
                  </td>
                ))}
                {shifts.map((s) => (
                  <td key={s.key} className="roster-total">
                    {shiftGrandTotal(s.key)}
                  </td>
                ))}
                <td className="roster-total">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div style={{ padding: 12 }}>
        <IonButton expand="block" onClick={exportFile} disabled={!shown.length}>
          <IonIcon slot="start" icon={downloadOutline} />
          {t('rosters.downloadFile')}
        </IonButton>
      </div>
    </div>
  );
}
