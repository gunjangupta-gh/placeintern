import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Input, Row, Segmented, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import {
  SafetyCertificateOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  TrophyOutlined,
  SearchOutlined,
  EyeOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import TrainingBreadcrumb from '../../../components/training/TrainingBreadcrumb';
import CertificatePreviewModal from '../../../components/training/CertificatePreviewModal';
import { CertificateCardSkeleton, TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { fetchCertificates } from '../store/facultyTrainingSlice';
import trainingService from '../../../services/training.service';

const { Text, Title } = Typography;

const CertificateCard = ({ certificate, onDownload, onPreview }) => (
  <Card
    className="rounded-xl border-border shadow-none hover:shadow-md h-full"
    styles={{ body: { padding: '16px' } }}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200">
        <TrophyOutlined className="text-xl text-amber-600" />
      </div>
      <Tag color="green" icon={<CheckCircleOutlined />}>Verified</Tag>
    </div>

    <Title level={5} className="!mb-1 line-clamp-2">{certificate.training?.title || 'Training'}</Title>
    <Text type="secondary" className="text-xs block mb-3 line-clamp-1">
      {certificate.training?.providedBy || 'Training Provider'}
    </Text>

    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <SafetyCertificateOutlined />
        <Text copyable={{ text: certificate.certificateNumber, tooltips: ['Copy ID', 'Copied!'] }} className="text-xs font-mono">
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
          <span>{certificate.training.duration} hours completed</span>
        </div>
      )}
    </div>

    <div className="flex gap-2">
      <Button
        type="default"
        icon={<EyeOutlined />}
        onClick={() => onPreview(certificate)}
        className="flex-1"
      >
        Preview
      </Button>
      <Button
        type="primary"
        icon={<DownloadOutlined />}
        onClick={() => onDownload(certificate.id, `certificate_${certificate.certificateNumber || certificate.id}.pdf`)}
        className="flex-1"
      >
        Download
      </Button>
    </div>
  </Card>
);

const MyCertificatesPage = () => {
  const dispatch = useDispatch();
  const { certificates } = useSelector((state) => state.facultyTraining);
  const { user } = useSelector((state) => state.auth);
  const [viewMode, setViewMode] = useState('grid');
  const [searchText, setSearchText] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    dispatch(fetchCertificates());
  }, [dispatch]);

  const handleDownload = async (id, filename = 'certificate.pdf') => {
    try {
      setDownloading(true);
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
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = (certificate) => {
    setSelectedCertificate({
      ...certificate,
      userName: user?.name || user?.firstName || 'Participant',
    });
    setPreviewOpen(true);
  };

  const certificateStats = useMemo(() => {
    const list = certificates.list || [];
    const latest = list
      .filter((item) => item.issuedAt)
      .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))[0];
    const providers = new Set(list.map((item) => item.training?.providedBy).filter(Boolean));
    const totalHours = list.reduce((sum, item) => sum + (item.training?.duration || 0), 0);
    return {
      total: list.length,
      latestIssued: latest?.issuedAt,
      providers: providers.size,
      totalHours,
    };
  }, [certificates.list]);

  const filteredCertificates = useMemo(() => {
    if (!searchText) return certificates.list || [];
    const search = searchText.toLowerCase();
    return (certificates.list || []).filter(
      (cert) =>
        cert.training?.title?.toLowerCase().includes(search) ||
        cert.certificateNumber?.toLowerCase().includes(search) ||
        cert.training?.providedBy?.toLowerCase().includes(search)
    );
  }, [certificates.list, searchText]);

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
        <Text copyable={{ tooltips: ['Copy', 'Copied!'] }} className="font-mono text-xs">{value}</Text>
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
      title: 'Duration',
      key: 'duration',
      width: 100,
      render: (_, record) => (
        record.training?.duration ? `${record.training.duration}h` : '-'
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
      width: 180,
      render: (_, record) => (
        <div className="flex gap-2">
          <Tooltip title="Preview">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
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
        </div>
      ),
    },
  ];

  const isLoading = certificates.loading && !certificates.list;

  return (
    <div className="p-4 training-ui">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <Title level={4} className="!mb-0.5 flex items-center gap-2 text-lg">
            <SafetyCertificateOutlined className="text-amber-500" />
            My Certificates
          </Title>
          <Text type="secondary" className="text-xs">
            Download certificates for completed trainings.
          </Text>
        </div>
        <Segmented
          size="small"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'grid', icon: <AppstoreOutlined />, label: <span className="hidden sm:inline ml-1">Grid</span> },
            { value: 'list', icon: <UnorderedListOutlined />, label: <span className="hidden sm:inline ml-1">Table</span> },
          ]}
        />
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} md={6}>
          <Card className="rounded-xl border-border shadow-none bg-gradient-to-br from-amber-50 via-white to-slate-50" styles={{ body: { padding: '12px' } }}>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100">
                <TrophyOutlined className="text-base text-amber-600" />
              </div>
              <Statistic title={<span className="text-[10px] uppercase font-semibold">Total</span>} value={certificateStats.total} valueStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }} />
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
            <Statistic
              title={<span className="text-[10px] uppercase font-semibold">Hours</span>}
              value={certificateStats.totalHours}
              suffix={<span className="text-xs">hrs</span>}
              valueStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
            <Statistic
              title={<span className="text-[10px] uppercase font-semibold">Latest</span>}
              value={
                certificateStats.latestIssued
                  ? new Date(certificateStats.latestIssued).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'N/A'
              }
              valueStyle={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
            <Statistic title={<span className="text-[10px] uppercase font-semibold">Providers</span>} value={certificateStats.providers} valueStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }} />
          </Card>
        </Col>
      </Row>

      {/* Search */}
      <Card className="rounded-xl border-border shadow-none mb-4" styles={{ body: { padding: '12px' } }}>
        <Input
          placeholder="Search certificates..."
          prefix={<SearchOutlined className="text-slate-400" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          size="middle"
          aria-label="Search certificates"
        />
      </Card>

      {/* Content */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <Row gutter={[12, 12]}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={idx}>
                <CertificateCardSkeleton />
              </Col>
            ))}
          </Row>
        ) : (
          <Card className="rounded-xl border-border shadow-none">
            <TableRowSkeleton rows={5} columns={5} />
          </Card>
        )
      ) : filteredCertificates.length === 0 ? (
        <Card className="rounded-xl border-border shadow-none">
          <TrainingEmptyState
            type={searchText ? 'search' : 'certificates'}
            message={searchText ? 'No matching certificates' : 'No certificates yet'}
            description={
              searchText
                ? 'Try adjusting your search terms.'
                : 'Complete trainings with full attendance to earn certificates.'
            }
            actionText={searchText ? 'Clear Search' : undefined}
            onAction={searchText ? () => setSearchText('') : undefined}
          />
        </Card>
      ) : viewMode === 'grid' ? (
        <Row gutter={[12, 12]}>
          {filteredCertificates.map((cert) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={cert.id}>
              <CertificateCard
                certificate={cert}
                onDownload={handleDownload}
                onPreview={handlePreview}
              />
            </Col>
          ))}
        </Row>
      ) : (
        <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 0 } }}>
          <div className="custom-scrollbar overflow-x-auto">
            <Table
              className="custom-table"
              rowKey="id"
              columns={columns}
              dataSource={filteredCertificates}
              loading={certificates.loading}
              size="small"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <Text className="text-[10px] text-slate-600">
                    {range[0]}-{range[1]} of {total}
                  </Text>
                ),
                size: "small",
              }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </Card>
      )}

      {/* Certificate Preview Modal */}
      <CertificatePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        certificate={selectedCertificate}
        onDownload={handleDownload}
        loading={downloading}
      />

      {/* Print Styles */}
      <style>{`
        @media print {
          .training-ui { padding: 0 !important; }
          .ant-card { border: none !important; box-shadow: none !important; }
          button, .ant-segmented, .ant-input-affix-wrapper { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default MyCertificatesPage;
