import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Popconfirm, Result, Row, Skeleton, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import ApplicationsReview from './ApplicationsReview';
import OpportunityEditModal from './OpportunityEditModal';

const { Title, Text } = Typography;
const STATUS_COLOR = { OPEN: 'green', CLOSED: 'default', DRAFT: 'orange', FILLED: 'blue' };

/** One internship: its details, seat counts, the selected students and every applicant. */
const OpportunityDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [opp, setOpp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOpp(await opportunityService.getOne(id));
      setMissing(false);
    } catch (err) {
      if (err?.response?.status === 404) setMissing(true);
      else toast.error(getErrorMessage(err, 'Failed to load the opportunity'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Approve / reject / delete change the seat counts above, so refresh them too.
  const onChanged = () => { load(); setRefreshKey((k) => k + 1); };

  // Same actions as the list page: close / reopen applications, delete
  const toggleStatus = async () => {
    setBusy(true);
    try {
      await opportunityService.update(opp.id, { status: opp.status === 'OPEN' ? 'CLOSED' : 'OPEN' });
      toast.success(opp.status === 'OPEN' ? 'Applications closed' : 'Applications reopened');
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await opportunityService.remove(opp.id);
      toast.success('Opportunity deleted');
      navigate('/app/internship-opportunities');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Delete failed'));
      setBusy(false);
    }
  };

  if (loading) return <div style={{ padding: 16 }}><Skeleton active paragraph={{ rows: 8 }} /></div>;
  if (missing || !opp) {
    return (
      <Result
        status="404"
        title="Opportunity not found"
        extra={<Button type="primary" onClick={() => navigate('/app/internship-opportunities')}>Back to opportunities</Button>}
      />
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/internship-opportunities')} style={{ marginBottom: 8 }}>
        All opportunities
      </Button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}>{opp.title}</Title>
        <Tag color={STATUS_COLOR[opp.status]}>{opp.status}</Tag>
        <Text type="secondary" strong>{opp.company?.name}</Text>
        <Space wrap style={{ marginLeft: 'auto' }}>
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit</Button>
          {opp.status !== 'FILLED' && (
            <Button
              loading={busy}
              icon={opp.status === 'OPEN' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={toggleStatus}
            >
              {opp.status === 'OPEN' ? 'Close applications' : 'Reopen applications'}
            </Button>
          )}
          <Popconfirm
            title="Delete this opportunity?"
            description="Not possible once students have applied."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={remove}
          >
            <Button danger loading={busy} icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Positions" value={opp.positions} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Active applications" value={opp.appliedCount} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Selected students" value={opp.approvedCount} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Seats left" value={opp.seatsLeft} valueStyle={{ color: opp.seatsLeft === 0 ? '#cf1322' : undefined }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="District">{opp.district || '-'}</Descriptions.Item>
          <Descriptions.Item label="Duration">{opp.durationMonths} months</Descriptions.Item>
          <Descriptions.Item label="Stipend">{opp.stipend || '-'}</Descriptions.Item>
          <Descriptions.Item label="Starts">{formatDate(opp.startDate)}</Descriptions.Item>
          <Descriptions.Item label="Apply by">{formatDate(opp.applicationDeadline)}</Descriptions.Item>
          <Descriptions.Item label="Eligible years">{opp.eligibleYears?.length ? opp.eligibleYears.join(', ') : 'All'}</Descriptions.Item>
          <Descriptions.Item label="Industry contact (State only)" span={3}>
            {[opp.contactName, opp.contactPhone, opp.contactEmail].filter(Boolean).join(' · ') || 'Not provided'}
          </Descriptions.Item>
          {opp.description && <Descriptions.Item label="Description" span={3}>{opp.description}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card size="small" title="Branch-wise positions" style={{ marginBottom: 12 }}>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={opp.branches || []}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Branch', render: (_, b) => <span>{b.name} <Text type="secondary">({b.code})</Text></span> },
            { title: 'Positions', dataIndex: 'positions' },
            { title: 'Stipend', dataIndex: 'stipend', render: (v) => v || opp.stipend || '-' },
            { title: 'Selected', dataIndex: 'approvedCount', render: (n) => <Text style={{ color: '#3f8600' }}>{n}</Text> },
            { title: 'Seats left', dataIndex: 'seatsLeft', render: (n) => <Text type={n === 0 ? 'danger' : undefined}>{n}</Text> },
            {
              title: 'Applications',
              render: (_, b) => (
                <span>
                  {b.appliedCount} / {b.applicationLimit}{' '}
                  {b.applicationsLeft === 0 && <Tag color="red" style={{ marginLeft: 4 }}>Full</Tag>}
                </span>
              ),
            },
          ]}
        />
      </Card>

      <Tabs
        destroyOnHidden
        defaultActiveKey="selected"
        items={[
          {
            key: 'selected',
            label: `Selected students (${opp.approvedCount})`,
            children: <ApplicationsReview opportunityId={id} fixedGroup="SELECTED" refreshKey={refreshKey} onChanged={onChanged} />,
          },
          {
            key: 'all',
            label: 'All applicants',
            children: <ApplicationsReview opportunityId={id} refreshKey={refreshKey} onChanged={onChanged} />,
          },
        ]}
      />
      {editing && (
        <OpportunityEditModal
          opportunity={opp}
          onClose={() => setEditing(false)}
          // positions / branches / status may all have changed, so reload the page data and the lists
          onSaved={() => { setEditing(false); onChanged(); }}
        />
      )}
    </div>
  );
};

export default OpportunityDetail;
