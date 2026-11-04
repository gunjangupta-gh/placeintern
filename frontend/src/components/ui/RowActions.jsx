import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import AppPopconfirm from './AppPopconfirm';

/**
 * Icon-only row actions with tooltips (the PIMS table style).
 *
 * actions: [{
 *   key, label, icon,                     // label / icon may be functions of the row (e.g. Close vs Reopen)
 *   onClick(record),
 *   danger,                               // red icon (every other look is the same plain icon; `type` / colours are ignored)
 *   hidden(record) | boolean,             // leave the action out
 *   disabled(record) | boolean,
 *   loading(record) | boolean,
 *   confirm: { title, description, okText } | (record) => {...},   // asks first (Popconfirm)
 *   render(record),                       // escape hatch: render anything (e.g. a dropdown) in this slot
 * }]
 */
const resolve = (value, record) => (typeof value === 'function' ? value(record) : value);

/** Plain icon: drop any colour / font size the caller put on it so every table looks the same. */
const plainIcon = (icon) =>
  React.isValidElement(icon)
    ? React.cloneElement(icon, { style: { ...(icon.props.style || {}), color: 'inherit', fontSize: undefined } })
    : icon;

const RowActions = ({ actions = [], record, size = 'small' }) => {
  const visible = actions.filter((a) => a && !resolve(a.hidden, record));
  if (!visible.length) return null;

  return (
    <Space size={2} wrap={false} onClick={(e) => e.stopPropagation()}>
      {visible.map((action, index) => {
        const key = action.key || action.label || index;
        if (action.render) return <React.Fragment key={key}>{action.render(record)}</React.Fragment>;

        const disabled = !!resolve(action.disabled, record);
        const label = typeof action.label === 'function' ? action.label(record) : action.label;
        const button = (
          <Button
            size={size}
            type="text"
            className="row-action-btn"
            danger={!!action.danger}
            aria-label={typeof label === 'string' ? label : undefined}
            icon={plainIcon(typeof action.icon === 'function' ? action.icon(record) : action.icon)}
            disabled={disabled}
            loading={!!resolve(action.loading, record)}
            onClick={action.confirm ? undefined : () => action.onClick?.(record)}
          />
        );

        const confirm = action.confirm ? resolve(action.confirm, record) : null;
        const withConfirm = confirm ? (
          <AppPopconfirm
            title={confirm.title ?? 'Are you sure?'}
            description={confirm.description}
            okText={confirm.okText || (action.danger ? 'Delete' : 'Confirm')}
            okButtonProps={{ danger: !!action.danger }}
            disabled={disabled}
            onConfirm={() => action.onClick?.(record)}
          >
            {button}
          </AppPopconfirm>
        ) : (
          button
        );

        return (
          <Tooltip key={key} title={label}>
            {/* a span keeps the tooltip working on a disabled button */}
            <span style={{ display: 'inline-flex' }}>{withConfirm}</span>
          </Tooltip>
        );
      })}
    </Space>
  );
};

export default RowActions;
