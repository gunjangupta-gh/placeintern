import React from 'react';
import { Drawer, Typography } from 'antd';

const { Text } = Typography;

/**
 * The one drawer. It IS the antd Drawer (all props pass through, nothing is defaulted); it adds
 * `subtitle` under the title and a `DrawerSection` helper for the body.
 */
const AppDrawer = ({ title, subtitle, children, ...rest }) => (
  <Drawer
    className={['app-drawer', rest.className].filter(Boolean).join(' ')}
    title={
      subtitle ? (
        <div>
          <div>{title}</div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{subtitle}</Text>
        </div>
      ) : (
        title
      )
    }
    {...rest}
  >
    {children}
  </Drawer>
);

/** Titled block inside a drawer: small uppercase heading, optional right-hand content, then the body. */
export const DrawerSection = ({ title, right, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgb(var(--color-text-tertiary))' }}>
        {title}
      </span>
      {right}
    </div>
    {children}
  </div>
);

export default AppDrawer;
