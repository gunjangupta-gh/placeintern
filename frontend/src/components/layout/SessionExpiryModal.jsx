import React from 'react';
import { Modal, Button } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

const SessionExpiryModal = ({
  visible,
  sessionInfo,
  onExtend,
  onLogout,
}) => {
  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ClockCircleOutlined className="text-orange-500" />
          <span>Session Expiring Soon</span>
        </div>
      }
      open={visible}
      onOk={onExtend}
      onCancel={onLogout}
      okText="Extend Session"
      cancelText="Logout Now"
      centered
      maskClosable={false}
      closable={false}
      footer={[
        <Button key="logout" onClick={onLogout} danger>
          Logout Now
        </Button>,
        <Button key="extend" type="primary" onClick={onExtend}>
          Extend Session
        </Button>,
      ]}
    >
      <div className="py-4">
        <p className="text-base mb-2">Your session will expire in:</p>
        <div className="text-2xl font-bold text-center text-orange-600 my-4">
          {sessionInfo?.formattedTime || '...'}
        </div>
        <p className="text-gray-500">
          Would you like to extend your session to continue working?
        </p>
      </div>
    </Modal>
  );
};

export default SessionExpiryModal;
