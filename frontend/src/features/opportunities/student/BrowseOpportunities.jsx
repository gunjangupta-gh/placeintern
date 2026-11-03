import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, Pagination, Popconfirm, Row, Skeleton, Space, Tag, Tooltip, Typography } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, TeamOutlined, ClockCircleOutlined, WalletOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';

const { Title, Text, Paragraph } = Typography;
const PAGE_SIZE = 9;

const STATUS_COLOR = { APPLIED: 'blue', UNDER_REVIEW: 'blue', SHORTLISTED: 'cyan', SELECTED: 'green', APPROVED: 'green', REJECTED: 'red', JOINED: 'green', COMPLETED: 'default' };

const OpportunityCard = ({ item, applying, onApply }) => {
  const primaryReason = item.reasons?.[0]?.message;
  const button = (
    <Button type="primary" disabled={!item.canApply} loading={applying} block>
      {item.applied ? 'Applied' : 'Apply'}
    </Button>
  );

  return (
    <Card
      hoverable
      style={{ height: '100%' }}
      title={<span style={{ whiteSpace: 'normal' }}>{item.title}</span>}
      extra={item.applied ? <Tag color={STATUS_COLOR[item.applicationStatus] || 'blue'}>{item.applicationStatus}</Tag> : null}
      actions={[
        item.canApply ? (
          <Popconfirm
            key="apply"
            title="Apply for this internship?"
            description="You can hold only one internship application at a time."
            okText="Apply"
            onConfirm={() => onApply(item)}
          >
            {button}
          </Popconfirm>
        ) : (
          <Tooltip key="apply" title={primaryReason}>
            <span style={{ display: 'block', padding: '0 16px' }}>{button}</span>
          </Tooltip>
        ),
      ]}
    >
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Text strong>{item.company?.name}</Text>
        {item.district && (
          <Text type="secondary"><EnvironmentOutlined /> {item.district}</Text>
        )}
        <Text><ClockCircleOutlined /> {item.durationMonths} month{item.durationMonths > 1 ? 's' : ''} &middot; starts {formatDate(item.startDate)}</Text>
        {item.stipend && <Text><WalletOutlined /> Stipend: {item.stipend}</Text>}
        <Text><TeamOutlined /> {item.seatsLeft} of {item.positions} position{item.positions > 1 ? 's' : ''} left</Text>
        <Text type={item.canApply ? undefined : 'secondary'}><CalendarOutlined /> Apply by {formatDate(item.applicationDeadline)}</Text>
        {item.description && (
          <Paragraph type="secondary" ellipsis={{ rows: 2, tooltip: item.description }} style={{ marginBottom: 0 }}>
            {item.description}
          </Paragraph>
        )}
        <div>
          {item.branches?.map((b) => <Tag key={b.code}>{b.name}</Tag>)}
          {item.eligibleYears?.length > 0 && <Tag color="purple">Year {item.eligibleYears.join(', ')}</Tag>}
        </div>
        {!item.canApply && !item.applied && primaryReason && (
          <Text type="danger" style={{ fontSize: 12 }}>{primaryReason}</Text>
        )}
      </Space>
    </Card>
  );
};

const BrowseOpportunities = () => {
  const [state, setState] = useState({ loading: true, data: [], meta: { total: 0 }, profile: null, activeApplication: null });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [applyingId, setApplyingId] = useState(null);
  const debounced = useDebounce(search, 300);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await opportunityService.listEligible({ page, limit: PAGE_SIZE, search: debounced });
      setState({ loading: false, data: res.data || [], meta: res.meta || { total: 0 }, profile: res.profile, activeApplication: res.activeApplication });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load internships'));
      setState((s) => ({ ...s, loading: false }));
    }
  }, [page, debounced]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced]);

  const handleApply = async (item) => {
    setApplyingId(item.id);
    try {
      await opportunityService.apply(item.id);
      toast.success(`Applied to ${item.title} at ${item.company?.name}`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit application'));
      await load(); // seats / eligibility may have changed
    } finally {
      setApplyingId(null);
    }
  };

  const { loading, data, meta, profile, activeApplication } = state;

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 4 }}>Internship Opportunities</Title>
      <Paragraph type="secondary">Internships open for your branch. You can apply to one internship.</Paragraph>

      {profile && !profile.complete && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Complete your profile to apply"
          description={
            <span>
              Missing: {profile.missing.map((m) => m.label).join(', ')}. <Link to="/app/profile">Go to My Profile</Link>
            </span>
          }
        />
      )}
      {activeApplication && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={activeApplication.isSelfIdentified ? 'You have a self-identified internship' : `Your application is ${activeApplication.status}`}
          description={<Link to="/app/my-applications">View my internship</Link>}
        />
      )}

      <Input.Search
        allowClear
        placeholder="Search by position, company or district"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 420, marginBottom: 16 }}
      />

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : data.length === 0 ? (
        <Empty description="No internships are open for your branch right now" />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {data.map((item) => (
              <Col key={item.id} xs={24} md={12} xl={8}>
                <OpportunityCard item={item} applying={applyingId === item.id} onApply={handleApply} />
              </Col>
            ))}
          </Row>
          <Pagination
            style={{ marginTop: 16, textAlign: 'center' }}
            current={page}
            pageSize={PAGE_SIZE}
            total={meta.total}
            showSizeChanger={false}
            onChange={setPage}
            hideOnSinglePage
          />
        </>
      )}
    </div>
  );
};

export default BrowseOpportunities;
