import type { ReactNode } from 'react';

export default function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '14px 16px 6px',
      }}
    >
      <span className="ui-caption">{title}</span>
      {action}
    </div>
  );
}
