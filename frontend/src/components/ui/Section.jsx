import React from 'react';
import { Spin } from 'antd';

/**
 * Plain titled block (instead of wrapping everything in a Card): heading + optional actions, then content.
 * `bordered` gives a light bordered panel for places where blocks must be told apart.
 */
const Section = ({ title, extra, loading = false, bordered = false, heading = false, className, style, children }) => (
  <div
    className={className}
    style={{
      marginBottom: heading ? 0 : 16,
      ...(bordered ? { border: '1px solid rgb(var(--color-border))', borderRadius: 8, padding: 16 } : {}),
      ...style,
    }}
  >
    {(title || extra) && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: heading ? 20 : 15 }}>{title}</div>
        {extra}
      </div>
    )}
    <Spin spinning={!!loading}>{children}</Spin>
  </div>
);

export default Section;
