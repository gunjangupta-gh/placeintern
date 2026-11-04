import React, { useState } from 'react';
import ConfirmModal from './ConfirmModal';

/**
 * Drop-in replacement for antd `Popconfirm` that asks in the PIMS-style confirm dialog instead of a small popup.
 * Same props as Popconfirm (title, description, onConfirm, onCancel, okText, cancelText, okButtonProps, disabled);
 * `placement`, `icon` etc. are accepted and ignored. Wrap the element that triggers the action.
 * Destructive (red) when `okButtonProps.danger` is set or `tone="danger"`; `reasonLabel` asks for a reason first.
 */
const AppPopconfirm = ({
  title,
  description,
  onConfirm,
  onCancel,
  okText,
  cancelText,
  okButtonProps,
  disabled = false,
  tone,
  reasonLabel,
  reasonRequired,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const danger = tone ? tone === 'danger' : !!okButtonProps?.danger;

  const close = () => {
    setOpen(false);
    onCancel?.();
  };

  const confirm = async (reason) => {
    setLoading(true);
    try {
      await onConfirm?.(reason);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      {/* a wrapper keeps this working whatever the child is (Button, Tooltip, Switch, link ...) */}
      <span
        style={{ display: 'inline-flex' }}
        onClick={(e) => {
          if (disabled) return;
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </span>
      <span style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
      <ConfirmModal
        open={open}
        title={title ?? 'Are you sure?'}
        text={description ?? ''}
        okText={okText || (danger ? 'Delete' : 'Confirm')}
        cancelText={cancelText || 'Cancel'}
        danger={danger}
        loading={loading}
        reasonLabel={reasonLabel}
        reasonRequired={reasonRequired}
        onConfirm={confirm}
        onCancel={close}
      />
      </span>
    </>
  );
};

export default AppPopconfirm;
