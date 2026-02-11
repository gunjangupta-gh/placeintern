import React from 'react';
import { Button, Dropdown, message, Tooltip } from 'antd';
import {
  ShareAltOutlined,
  CopyOutlined,
  MailOutlined,
  WhatsAppOutlined,
  LinkOutlined,
} from '@ant-design/icons';

/**
 * Share training component with multiple sharing options
 */
const ShareTraining = ({
  training,
  buttonType = 'default',
  buttonSize = 'middle',
  showLabel = true,
  className = '',
}) => {
  if (!training) return null;

  const trainingUrl = `${window.location.origin}/app/training/${training.id}`;
  const trainingTitle = training.title || 'Training';
  const trainingDescription = training.description || '';
  const trainingDates = training.startDate
    ? `${new Date(training.startDate).toLocaleDateString()} - ${new Date(training.endDate).toLocaleDateString()}`
    : '';

  const shareText = `Check out this training: ${trainingTitle}${trainingDates ? ` (${trainingDates})` : ''}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trainingUrl);
    message.success('Training link copied to clipboard');
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Training: ${trainingTitle}`);
    const body = encodeURIComponent(
      `Hi,\n\nI thought you might be interested in this training:\n\n` +
        `${trainingTitle}\n` +
        `${trainingDescription ? trainingDescription.substring(0, 200) + '...\n\n' : ''}` +
        `${trainingDates ? `Dates: ${trainingDates}\n` : ''}` +
        `\nView details: ${trainingUrl}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${shareText}\n\n${trainingUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const menuItems = [
    {
      key: 'copy',
      label: 'Copy link',
      icon: <CopyOutlined />,
      onClick: handleCopyLink,
    },
    {
      key: 'email',
      label: 'Share via email',
      icon: <MailOutlined />,
      onClick: handleEmailShare,
    },
    {
      key: 'whatsapp',
      label: 'Share on WhatsApp',
      icon: <WhatsAppOutlined />,
      onClick: handleWhatsAppShare,
    },
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Tooltip title={!showLabel ? 'Share training' : undefined}>
        <Button
          type={buttonType}
          size={buttonSize}
          icon={<ShareAltOutlined />}
          className={className}
        >
          {showLabel && 'Share'}
        </Button>
      </Tooltip>
    </Dropdown>
  );
};

export default ShareTraining;
