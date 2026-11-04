import React from 'react';
import { Modal, Typography } from 'antd';
import { ConfirmIcon } from './ConfirmModal';

const { Text } = Typography;

const WIDTHS = { sm: 440, md: 600, lg: 800, xl: 1000 };

/**
 * The one modal. It IS the antd Modal: every prop passes through and no behaviour is defaulted
 * (mask click, destroy-on-close, footer ... stay exactly as the caller set them). It adds:
 *  - description : muted line under the title
 *  - size        : sm | md | lg | xl, used only when `width` is not given
 * The antd statics (Modal.confirm, useModal ...) are available on it too.
 */
const AppModal = ({ title, description, size, width, children, ...rest }) => (
  <Modal
    className={['app-modal', rest.className].filter(Boolean).join(' ')}
    width={width ?? (size ? WIDTHS[size] : undefined)}
    title={
      description ? (
        <div>
          <div>{title}</div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{description}</Text>
        </div>
      ) : (
        title
      )
    }
    {...rest}
  >
    {children}
  </Modal>
);

/**
 * Config for a confirm dialog in the PIMS look (centred, round warning icon). Use it with the hook form too:
 *   const { modal } = App.useApp();  modal.confirm(confirmLook({ title, content, onOk }))
 */
export const confirmLook = (config = {}) => {
  const danger = config.okType === 'danger' || !!config.okButtonProps?.danger;
  return {
    centered: true,
    width: 440,
    ...config,
    icon: config.icon === null || config.icon === false ? config.icon : <ConfirmIcon danger={danger} />,
    className: ['app-confirm', config.className].filter(Boolean).join(' '),
  };
};

/** Modal.confirm in the confirm-dialog look. Same config as antd. */
AppModal.confirm = (config = {}) => Modal.confirm(confirmLook(config));
AppModal.info = Modal.info;
AppModal.success = Modal.success;
AppModal.error = Modal.error;
AppModal.warning = Modal.warning;
AppModal.useModal = Modal.useModal;
AppModal.destroyAll = Modal.destroyAll;
AppModal.config = Modal.config;

export default AppModal;
