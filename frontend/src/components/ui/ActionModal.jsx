import React from 'react';
import AppModal from './AppModal';

/** A modal that asks for something (remarks, a reason, a form) and then runs an action. */
const ActionModal = ({
  open,
  title,
  description,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  danger = false,
  disabled = false,
  loading = false,
  size = 'md',
  onConfirm,
  onClose,
  children,
}) => (
  <AppModal
    open={open}
    title={title}
    description={description}
    size={size}
    okText={confirmLabel}
    cancelText={cancelLabel}
    okButtonProps={{ danger, disabled }}
    confirmLoading={loading}
    onOk={onConfirm}
    onCancel={onClose}
    maskClosable={false}
    destroyOnHidden
  >
    {children}
  </AppModal>
);

export default ActionModal;
