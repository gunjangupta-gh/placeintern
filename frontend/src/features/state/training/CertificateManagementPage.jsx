import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Row, Table, Tag, Typography, message } from 'antd';
import { useParams } from 'react-router-dom';
import { SafetyCertificateOutlined, CheckCircleOutlined, CloseCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton, TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import {
  fetchStateTrainingCertificates,
  issueStateCertificate,
  bulkIssueStateCertificates,
  revokeStateCertificate,
} from '../store/stateTrainingSlice';

const { Text } = Typography;

const STAT_TONES = {
  primary: { icon: 'bg-blue-100 text-blue-700', card: 'bg-gradient-to-br from-blue-50 via-white to-slate-50' },
  success: { icon: 'bg-emerald-100 text-emerald-700', card: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50' },
  error: { icon: 'bg-red-100 text-red-700', card: 'bg-gradient-to-br from-red-50 via-white to-slate-50' },
  secondary: { icon: 'bg-slate-100 text-slate-700', card: 'bg-gradient-to-br from-slate-50 via-white to-blue-50' },
};

const StatCard = ({ icon: Icon, title, value, subtitle, tone, trend, onClick }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.primary;
  const hasTrend = trend !== undefined && trend !== null;
  const isPositiveTrend = hasTrend && trend >= 0;

  return (
    <Card
      className={`rounded-2xl border-border shadow-none ${onClick ? 'cursor-pointer hover:shadow-soft' : ''} transition-shadow h-full ${styles.card}`}
      onClick={onClick}
      styles={{ body: { padding: '16px' } }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${title}: ${value}. ${subtitle || ''}${hasTrend ? ` Trend: ${isPositiveTrend ? 'up' : 'down'} ${Math.abs(trend)}%` : ''}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-text-secondary text-xs block mb-1">{title}</Text>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{value}</span>
            {hasTrend && (
              <span className={`flex items-center text-xs font-medium ${isPositiveTrend ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositiveTrend ? <ArrowUpOutlined className="mr-0.5" /> : <ArrowDownOutlined className="mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {subtitle && <Text type="secondary" className="text-xs">{subtitle}</Text>}
        </div>
        {Icon && (
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${styles.icon}`}>
            <Icon className="text-lg" />
          </div>
        )}
      </div>
    </Card>
  );
};

const CertificateManagementPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { certificates } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateTrainingCertificates({ trainingId: id }));
  }, [dispatch, id]);

  const isLoading = certificates.loading && !certificates.list;

  const handleIssue = async () => {
    try {
      const values = await form.validateFields();
      if (values.userId) {
        await dispatch(issueStateCertificate({ trainingId: id, userId: values.userId })).unwrap();
      } else if (values.userIds) {
        const userIds = values.userIds
          .split(',')
          .map((val) => val.trim())
          .filter(Boolean);
        await dispatch(bulkIssueStateCertificates({ trainingId: id, data: { userIds } })).unwrap();
      }
      message.success('Certificates issued');
      form.resetFields();
      dispatch(fetchStateTrainingCertificates({ trainingId: id }));
    } catch (error) {
      message.error(error || 'Failed to issue certificates');
    }
  };

  const handleRevoke = async (certId) => {
    try {
      await dispatch(revokeStateCertificate({ id: certId, data: { reason: 'Revoked by admin' } })).unwrap();
      message.success('Certificate revoked');
      dispatch(fetchStateTrainingCertificates({ trainingId: id }));
    } catch (error) {
      message.error(error || 'Failed to revoke certificate');
    }
  };

  const columns = [
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => record.user?.name || record.user?.email || 'Faculty',
    },
    {
      title: 'Certificate No',
      dataIndex: 'certificateNumber',
      key: 'certificateNumber',
    },
    {
      title: 'Status',
      dataIndex: 'isValid',
      key: 'isValid',
      render: (value) => (
        value
          ? <Tag color="green" icon={<CheckCircleOutlined />}>Valid</Tag>
          : <Tag color="red" icon={<CloseCircleOutlined />}>Revoked</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          size="small"
          danger
          onClick={() => handleRevoke(record.id)}
          aria-label={`Revoke certificate for ${record.user?.name || 'faculty'}`}
        >
          Revoke
        </Button>
      ),
    },
  ];

  const stats = useMemo(() => {
    const list = certificates.list || [];
    return {
      total: list.length,
      valid: list.filter((item) => item.isValid).length,
      revoked: list.filter((item) => item.isValid === false).length,
    };
  }, [certificates.list]);

  const filteredCertificates = useMemo(() => {
    if (!searchText) return certificates.list || [];
    const search = searchText.toLowerCase();
    return (certificates.list || []).filter((item) =>
      (item.user?.name || item.user?.email || '').toLowerCase().includes(search) ||
      (item.certificateNumber || '').toLowerCase().includes(search)
    );
  }, [certificates.list, searchText]);

  const searchResultCount = searchText ? filteredCertificates.length : null;

  return (
    <div className="p-6 training-ui" role="main" aria-label="Certificate Management">
      <PageHeader
        icon={SafetyCertificateOutlined}
        title={<span className="training-heading">Certificate Management</span>}
        description="Issue and manage certificates for this training."
      />

      <Row gutter={[16, 16]} className="mb-6" role="region" aria-label="Certificate statistics">
        {isLoading ? (
          <>
            <Col xs={24} md={8}><TrainingStatSkeleton /></Col>
            <Col xs={24} md={8}><TrainingStatSkeleton /></Col>
            <Col xs={24} md={8}><TrainingStatSkeleton /></Col>
          </>
        ) : (
          <>
            <Col xs={24} md={8}>
              <StatCard
                icon={SafetyCertificateOutlined}
                title="Total"
                value={stats.total}
                tone="primary"
              />
            </Col>
            <Col xs={24} md={8}>
              <StatCard
                icon={CheckCircleOutlined}
                title="Valid"
                value={stats.valid}
                tone="success"
              />
            </Col>
            <Col xs={24} md={8}>
              <StatCard
                icon={CloseCircleOutlined}
                title="Revoked"
                value={stats.revoked}
                tone="error"
              />
            </Col>
          </>
        )}
      </Row>

      <Card className="rounded-2xl border-border shadow-none mb-6" title="Issue Certificates">
        <Form layout="vertical" form={form}>
          <Form.Item name="userId" label="Single User ID">
            <Input placeholder="User ID" aria-label="Single user ID for certificate" />
          </Form.Item>
          <Form.Item name="userIds" label="Bulk User IDs (comma separated)">
            <Input.TextArea rows={2} placeholder="user-id-1, user-id-2" aria-label="Bulk user IDs for certificates" />
          </Form.Item>
          <Button type="primary" onClick={handleIssue} aria-label="Issue certificates">
            Issue
          </Button>
        </Form>
      </Card>

      <Card className="rounded-2xl border-border shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search faculty or certificate number"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="lg:w-80"
              allowClear
              aria-label="Search certificates"
            />
            {searchResultCount !== null && (
              <Text type="secondary" className="text-sm" aria-live="polite">
                {searchResultCount} result{searchResultCount !== 1 ? 's' : ''} found
              </Text>
            )}
          </div>
        </div>
        {isLoading ? (
          <TableRowSkeleton rows={5} columns={4} />
        ) : filteredCertificates.length > 0 ? (
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredCertificates}
            loading={certificates.loading}
            pagination={{ pageSize: 10 }}
            aria-label="Certificates table"
          />
        ) : (
          <TrainingEmptyState
            type={searchText ? 'search' : 'certificates'}
            message={searchText ? 'No certificates found' : 'No certificates issued yet'}
            description={searchText ? 'Try adjusting your search terms.' : 'Issue certificates to faculty who have completed the training.'}
            actionText={searchText ? 'Clear Search' : null}
            onAction={searchText ? () => setSearchText('') : null}
          />
        )}
      </Card>
    </div>
  );
};

export default CertificateManagementPage;
