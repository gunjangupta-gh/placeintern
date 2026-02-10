import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Row, Segmented, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import {
  SafetyCertificateOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { fetchCertificates } from '../store/facultyTrainingSlice';
import trainingService from '../../../services/training.service';

const { Text, Title } = Typography;

const CertificateCard = ({ certificate, onDownload }) => (
  <Card className="rounded-xl border-border shadow-none hover:shadow-sm transition-shadow"
    styles={{ body: { padding: '16px' } }}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-100">
        <TrophyOutlined className="text-xl text-amber-600" />
      </div>
      <Tag color="green" icon={<CheckCircleOutlined />}>Verified</Tag>
    </div>

    <Title level={5} className="!mb-1">{certificate.training?.title || 'Training'}</Title>
    <Text type="secondary" className="text-xs block mb-3">
      {certificate.training?.providedBy || 'Training Provider'}
    </Text>

    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <SafetyCertificateOutlined />
        <Text copyable={{ text: certificate.certificateNumber }} className="text-xs">
          {certificate.certificateNumber}
        </Text>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <CalendarOutlined />
        <span>
          Issued {certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }) : 'N/A'}
        </span>
      </div>
      {certificate.training?.duration && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span>{certificate.training.duration} hours</span>
        </div>
      )}
    </div>

    <Button
      type="primary"
      icon={<DownloadOutlined />}
      onClick={() => onDownload(certificate.id, `certificate_${certificate.certificateNumber || certificate.id}.pdf`)}
      block
    >
      Download Certificate
    </Button>
  </Card>
);

const MyCertificatesPage = () => {
  const dispatch = useDispatch();
  const { certificates } = useSelector((state) => state.facultyTraining);
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    dispatch(fetchCertificates());
  }, [dispatch]);

  const handleDownload = async (id, filename = 'certificate.pdf') => {
    try {
      message.loading({ content: 'Preparing certificate...', key: 'download' });
      const blob = await trainingService.downloadCertificate(id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success({ content: 'Certificate downloaded!', key: 'download' });
    } catch (error) {
      message.error({ content: error?.message || 'Failed to download certificate', key: 'download' });
    }
  };

  const certificateStats = useMemo(() => {
    const list = certificates.list || [];
    const latest = list
      .filter((item) => item.issuedAt)
      .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))[0];
    const providers = new Set(list.map((item) => item.training?.providedBy).filter(Boolean));
    return {
      total: list.length,
      latestIssued: latest?.issuedAt,
      providers: providers.size,
    };
  }, [certificates.list]);

  const columns = [
    {
      title: 'Training',
      dataIndex: ['training', 'title'],
      key: 'training',
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.training?.title || 'Training'}</div>
          <Text type="secondary" className="text-xs">
            {record.training?.providedBy || ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Certificate Number',
      dataIndex: 'certificateNumber',
      key: 'certificateNumber',
      render: (value) => (
        <Text copyable className="font-mono text-xs">{value}</Text>
      ),
    },
    {
      title: 'Training Dates',
      key: 'dates',
      render: (_, record) => (
        record.training?.startDate ? (
          <TrainingDateRange
            startDate={record.training.startDate}
            endDate={record.training.endDate}
            compact
          />
        ) : '-'
      ),
    },
    {
      title: 'Issued On',
      dataIndex: 'issuedAt',
      key: 'issuedAt',
      sorter: (a, b) => new Date(a.issuedAt) - new Date(b.issuedAt),
      render: (value) => (
        value ? new Date(value).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) : '-'
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Tooltip title="Download">
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id, `certificate_${record.certificateNumber || record.id}.pdf`)}
          >
            Download
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={SafetyCertificateOutlined}
        title={<span className="training-heading">My Certificates</span>}
        description="View and download certificates for trainings you have completed."
        actions={[
          <Segmented
            key="view-toggle"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'list', label: 'Table' },
            ]}
          />,
        ]}
      />

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Certificates" value={certificateStats.total} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic
              title="Latest Issued"
              value={
                certificateStats.latestIssued
                  ? new Date(certificateStats.latestIssued).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A'
              }
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Providers" value={certificateStats.providers} />
          </Card>
        </Col>
      </Row>

      {certificates.list?.length === 0 && !certificates.loading ? (
        <Card className="rounded-xl border-border shadow-none">
          <TrainingEmptyState
            type="certificates"
            message="No certificates yet"
            description="Complete trainings with attendance to earn certificates."
          />
        </Card>
      ) : viewMode === 'grid' ? (
        <Row gutter={[16, 16]}>
          {(certificates.list || []).map((cert) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={cert.id}>
              <CertificateCard certificate={cert} onDownload={handleDownload} />
            </Col>
          ))}
        </Row>
      ) : (
        <Card className="rounded-xl border-border shadow-none">
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={certificates.list}
            loading={certificates.loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} certificates`,
            }}
          />
        </Card>
      )}
    </div>
  );
};

export default MyCertificatesPage;
