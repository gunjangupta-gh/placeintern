import React from 'react';
import { AppModal } from '../../../components/ui';
import BulkUpload from './BulkUpload';

const TITLES = {
  students: 'Bulk Upload Students',
  staff: 'Bulk Upload Staff',
};

/**
 * Bulk upload dialog for the Students / Staff list pages.
 * `type` fixes the upload to 'students' or 'staff'; `onUploaded` lets the list refresh itself.
 */
const BulkUploadModal = ({ open, type, onClose, onUploaded }) => (
  <AppModal
    title={TITLES[type] || 'Bulk Upload'}
    open={open}
    onCancel={onClose}
    footer={null}
    width={1100}
    destroyOnClose
    maskClosable={false}
  >
    <BulkUpload fixedType={type} embedded onUploaded={onUploaded} />
  </AppModal>
);

export default BulkUploadModal;
