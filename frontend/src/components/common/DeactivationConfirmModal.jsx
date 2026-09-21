import React from 'react';
import { Modal, Select, Input } from 'antd';

const { Option } = Select;
const { TextArea } = Input;

// Keep in sync with backend DeactivationReason enum (see schema.prisma)
export const DEACTIVATION_REASONS = [
  { value: 'DROPOUT', label: 'Dropout' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'DISCIPLINARY', label: 'Disciplinary Action' },
  { value: 'DATA_CLEANUP', label: 'Data Cleanup' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Confirmation modal shown before deactivating a student - captures a reason
 * and optional remarks so the deactivation is auditable later, instead of a
 * plain yes/no confirm. Used across Principal/Faculty/State-Directorate
 * student pages wherever a student can be deactivated.
 */
const DeactivationConfirmModal = ({
  open,
  studentName,
  reason,
  remarks,
  onReasonChange,
  onRemarksChange,
  onCancel,
  onConfirm,
  confirmLoading = false,
  description,
}) => (
  <Modal
    title="Deactivate Student"
    open={open}
    onCancel={onCancel}
    onOk={onConfirm}
    okText="Deactivate"
    okButtonProps={{ danger: true, loading: confirmLoading }}
    cancelButtonProps={{ disabled: confirmLoading }}
    destroyOnClose
  >
    <p>
      Are you sure you want to deactivate <strong>{studentName}</strong>?{' '}
      {description || 'This will also deactivate their mentor assignment and internship application.'}
    </p>
    <div style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 4, fontSize: 13, color: 'rgba(0, 0, 0, 0.65)' }}>Reason</div>
      <Select
        style={{ width: '100%' }}
        placeholder="Select a reason"
        value={reason}
        onChange={onReasonChange}
      >
        {DEACTIVATION_REASONS.map((r) => (
          <Option key={r.value} value={r.value}>{r.label}</Option>
        ))}
      </Select>
    </div>
    <div>
      <div style={{ marginBottom: 4, fontSize: 13, color: 'rgba(0, 0, 0, 0.65)' }}>Remarks (optional)</div>
      <TextArea
        rows={3}
        placeholder="Any additional detail, e.g. destination institution, notice reference, etc."
        value={remarks}
        onChange={(e) => onRemarksChange(e.target.value)}
      />
    </div>
  </Modal>
);

export default DeactivationConfirmModal;
