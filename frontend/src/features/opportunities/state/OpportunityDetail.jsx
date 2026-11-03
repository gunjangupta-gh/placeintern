import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Result, Row, Skeleton, Statistic, Tabs, Tag, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import ApplicationsReview from './ApplicationsReview';

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
          <Descriptions.Item label="Branches" span={3}>{opp.branches?.map((b) => <Tag key={b.id}>{b.name}</Tag>)}</Descriptions.Item>
          <Descriptions.Item label="Industry contact (State only)" span={3}>
            {[opp.contactName, opp.contactPhone, opp.contactEmail].filter(Boolean).join(' · ') || 'Not provided'}
          </Descriptions.Item>
          {opp.description && <Descriptions.Item label="Description" span={3}>{opp.description}</Descriptions.Item>}
        </Descriptions>
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
    </div>
  );
};

export default OpportunityDetail;
