import React from 'react';
import { Modal, Button, Space, Typography, Divider, message, Tooltip } from 'antd';
import {
  DownloadOutlined,
  LinkedinOutlined,
  CopyOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  CalendarOutlined,
  UserOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/**
 * Certificate preview modal with sharing options
 */
const CertificatePreviewModal = ({
  open,
  onClose,
  certificate,
  onDownload,
  loading = false,
}) => {
  if (!certificate) return null;

  const training = certificate.training || {};
  const certificateNumber = certificate.certificateNumber || certificate.id;

  const handleCopyLink = () => {
    const verifyUrl = `${window.location.origin}/verify-certificate/${certificateNumber}`;
    navigator.clipboard.writeText(verifyUrl);
    message.success('Verification link copied to clipboard');
  };

  const handleShareLinkedIn = () => {
    const title = encodeURIComponent(`I completed "${training.title || 'Training'}" training!`);
    const summary = encodeURIComponent(
      `I successfully completed ${training.title || 'a professional development training'} ` +
        `provided by ${training.providedBy || 'PlaceIntern'}. ` +
        `Certificate ID: ${certificateNumber}`
    );
    const url = encodeURIComponent(`${window.location.origin}/verify-certificate/${certificateNumber}`);

    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${summary}`;
    window.open(linkedInUrl, '_blank', 'width=600,height=600');
  };

  const handlePrint = () => {
    if (onDownload) {
      onDownload(certificate.id, `certificate_${certificateNumber}.pdf`);
      message.info('Download started. You can print from your PDF viewer.');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      centered
      title={
        <div className="flex items-center gap-2">
          <SafetyCertificateOutlined className="text-emerald-600" />
          <span>Certificate Preview</span>
        </div>
      }
    >
      {/* Certificate Preview Card */}
      <div className="bg-gradient-to-br from-emerald-50 via-white to-amber-50 rounded-xl p-6 border border-emerald-200 mb-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
              <TrophyOutlined className="text-3xl text-white" />
            </div>
          </div>
          <Title level={4} className="!mb-1 text-emerald-800">
            Certificate of Completion
          </Title>
          <Text className="text-emerald-600">Professional Development Training</Text>
        </div>

        {/* Certificate Details */}
        <div className="bg-white/60 rounded-lg p-4 mb-4">
          <Title level={5} className="!mb-3 text-center">
            {training.title || 'Training Program'}
          </Title>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <UserOutlined className="text-slate-400" />
              <div>
                <Text className="text-text-tertiary block text-xs">Recipient</Text>
                <Text className="font-medium">{certificate.userName || 'Participant'}</Text>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CalendarOutlined className="text-slate-400" />
              <div>
                <Text className="text-text-tertiary block text-xs">Issued On</Text>
                <Text className="font-medium">
                  {certificate.issuedAt
                    ? new Date(certificate.issuedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </Text>
              </div>
            </div>

            {training.duration && (
              <div className="flex items-center gap-2">
                <ClockCircleOutlined className="text-slate-400" />
                <div>
                  <Text className="text-text-tertiary block text-xs">Duration</Text>
                  <Text className="font-medium">{training.duration} hours</Text>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <SafetyCertificateOutlined className="text-slate-400" />
              <div>
                <Text className="text-text-tertiary block text-xs">Certificate ID</Text>
                <Text className="font-mono text-xs font-medium">{certificateNumber}</Text>
              </div>
            </div>
          </div>
        </div>

        {/* Provider */}
        <div className="text-center">
          <Text className="text-text-secondary text-sm">Provided by</Text>
          <Text className="block font-medium text-slate-700">
            {training.providedBy || 'PlaceIntern Training Platform'}
          </Text>
        </div>
      </div>

      <Divider className="my-4" />

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          size="large"
          block
          loading={loading}
          onClick={() => onDownload?.(certificate.id, `certificate_${certificateNumber}.pdf`)}
        >
          Download Certificate (PDF)
        </Button>

        <div className="grid grid-cols-3 gap-3">
          <Tooltip title="Share on LinkedIn">
            <Button
              icon={<LinkedinOutlined />}
              onClick={handleShareLinkedIn}
              className="flex items-center justify-center"
            >
              LinkedIn
            </Button>
          </Tooltip>

          <Tooltip title="Copy verification link">
            <Button
              icon={<CopyOutlined />}
              onClick={handleCopyLink}
              className="flex items-center justify-center"
            >
              Copy Link
            </Button>
          </Tooltip>

          <Tooltip title="Print certificate">
            <Button
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              className="flex items-center justify-center"
            >
              Print
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Verification Note */}
      <div className="mt-4 p-3 bg-slate-50 rounded-lg">
        <Text className="text-xs text-text-secondary">
          This certificate can be verified at any time using the certificate ID or the verification link.
          Share it with confidence on your professional profiles.
        </Text>
      </div>
    </Modal>
  );
};

export default CertificatePreviewModal;
