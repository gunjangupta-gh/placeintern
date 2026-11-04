import React, { useEffect, useState } from 'react';
import { Button, Input, Modal } from 'antd';
import { ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';

/** Round coloured icon of the confirm dialogs (red for destructive, amber otherwise). */
export const ConfirmIcon = ({ danger = true }) => (
  <span className={`app-confirm-icon app-confirm-icon--${danger ? 'danger' : 'warning'}`}>
    {danger ? <WarningOutlined /> : <ExclamationCircleOutlined />}
  </span>
);

/**
 * The delete / confirm dialog (same layout as the PIMS ConfirmDialog): a centred box with a round warning icon,
 * the title and a muted line of text, an optional reason box, and Cancel + a red confirm button on the right.
 * Controlled by `open`. `onConfirm(reason)` may be async: the button shows a spinner until it finishes.
 */
const ConfirmModal = ({
  open,
  title = 'Are you sure?',
  text = 'This action cannot be undone.',
  okText = 'Delete',
  cancelText = 'Cancel',
  danger = true,
  loading = false,
  reasonLabel,
  reasonRequired = false,
  reasonMin = 3,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  const blocked = reasonRequired && reason.trim().length < reasonMin;

  return (
    <Modal
      open={open}
      centered
      closable={false}
      footer={null}
      width={440}
      maskClosable={!loading}
      keyboard={!loading}
      destroyOnHidden
      className="app-modal app-confirm-dialog"
      onCancel={onCancel}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <ConfirmIcon danger={danger} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          {text ? <div style={{ marginTop: 4, fontSize: 13, color: 'rgb(var(--color-text-secondary))' }}>{text}</div> : null}
          {reasonLabel ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{reasonLabel}</div>
              <Input.TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter reason" />
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onCancel} disabled={loading}>{cancelText}</Button>
        <Button type="primary" danger={danger} loading={loading} disabled={blocked} onClick={() => onConfirm?.(reason)}>
          {okText}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
