import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, Pagination, Popconfirm, Progress, Row, Skeleton, Tag, Tooltip, Typography, theme } from 'antd';
import {
  BankOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';
import { useDebounce } from '../../../hooks/useDebounce';

const { Title, Text, Paragraph } = Typography;
const PAGE_SIZE = 12;

const STATUS_COLOR = { APPLIED: 'blue', UNDER_REVIEW: 'blue', SHORTLISTED: 'cyan', SELECTED: 'green', APPROVED: 'green', REJECTED: 'red', JOINED: 'green', COMPLETED: 'default' };

/** Whole days left until the deadline (0 = closes today). Null if already past. */
const daysLeft = (deadline) => {
  const ms = new Date(deadline).getTime() - Date.now();
  return ms < 0 ? null : Math.ceil(ms / 86400000) - 1;
};

/** Inline icon + text (location, stipend, duration...). */
const Meta = ({ icon, children, token }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: token.colorTextSecondary, minWidth: 0 }}>
    <span style={{ display: 'flex', fontSize: 14 }}>{icon}</span>
    <span style={{ whiteSpace: 'nowrap' }}>{children}</span>
  </span>
);

/** Rounded coloured chip. tone: info | warning | error | success */
const Pill = ({ tone = 'info', icon, children, token }) => {
  const palette = {
    info: [token.colorInfoBg, token.colorInfo],
    warning: [token.colorWarningBg, token.colorWarningText],
    error: [token.colorErrorBg, token.colorError],
    success: [token.colorSuccessBg, token.colorSuccess],
  }[tone];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999,
        background: palette[0], color: palette[1], fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </span>
  );
};

const OpportunityCard = ({ item, applying, onApply }) => {
  const { token } = theme.useToken();
  const primaryReason = item.reasons?.[0]?.message;
  const inlineReasons = (item.reasons || []).filter((r) => r.code !== 'MAX_APPLICATIONS_REACHED');
  const allReasons = (item.reasons || []).map((r) => r.message);
  const cap = item.applicationLimit || 0;
  const received = item.applicationsReceived || 0;
  const applicationsLow = cap > 0 && item.applicationsLeft > 0 && item.applicationsLeft / cap <= 0.2;
  const hasWaitingList = cap > item.positions;
  const left = daysLeft(item.applicationDeadline);
  const urgent = left !== null && left <= 3;
  const lowSeats = item.positions > 0 && item.seatsLeft > 0 && item.seatsLeft / item.positions <= 0.2;
  const hiring = left !== null && item.seatsLeft > 0 && item.applicationsLeft > 0;
  const months = `${item.durationMonths} ${item.durationMonths > 1 ? 'Months' : 'Month'}`;

  const deadlineText =
    left === null ? 'Closed' : left === 0 ? 'Closes today' : urgent ? `${left} day${left > 1 ? 's' : ''} left` : `Apply by ${formatDate(item.applicationDeadline)}`;

  const applyButton = (
    <Button type="primary" size="small" disabled={!item.canApply} loading={applying}>
      {item.applied ? 'Applied' : 'Apply'}
    </Button>
  );

  return (
    <Card
      hoverable
      style={{ height: '100%', borderRadius: 12, borderColor: token.colorBorderSecondary }}
      styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12 } }}
    >
      {/* Title, company + hiring badge, logo */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text strong style={{ fontSize: 16, display: 'block', lineHeight: 1.3 }} ellipsis={{ tooltip: item.title }}>
            {item.title}
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <Text type="secondary" strong style={{ fontSize: 13 }} ellipsis={{ tooltip: item.company?.name }}>
              {item.company?.name}
            </Text>
            {item.applied ? (
              <Tag color={STATUS_COLOR[item.applicationStatus] || 'blue'} icon={<CheckCircleFilled />} style={{ margin: 0, fontSize: 11 }}>
                {item.applicationStatus?.replace('_', ' ')}
              </Tag>
            ) : (
              hiring && (
                <Tag color="blue" variant="outlined" style={{ margin: 0, fontSize: 11, borderRadius: 999, background: 'transparent' }}>
                  Actively hiring
                </Tag>
              )
            )}
          </div>
        </div>
        <div
          style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: token.colorPrimaryBg, color: token.colorPrimary, fontSize: 20,
          }}
        >
          <BankOutlined />
        </div>
      </div>

      {/* Location, stipend, duration, start */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
        {item.district && <Meta token={token} icon={<EnvironmentOutlined />}>{item.district}</Meta>}
        <Meta token={token} icon={<WalletOutlined />}>{item.stipend || 'Not specified'}</Meta>
        <Meta token={token} icon={<ClockCircleOutlined />}>{months}</Meta>
        <Meta token={token} icon={<CalendarOutlined />}>Starts {formatDate(item.startDate)}</Meta>
      </div>

      {item.description && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: token.colorTextSecondary, fontSize: 13, minWidth: 0 }}>
          <FileTextOutlined />
          <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ tooltip: item.description }}>{item.description}</Text>
        </div>
      )}

      {item.eligibleYears?.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Open to: {item.eligibleYears.map((y) => `Year ${y}`).join(' • ')}
        </Text>
      )}

      {/* Applications received for the student's own branch vs its limit */}
      {cap > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: token.colorTextSecondary }}>
            <span>Applications for your branch{hasWaitingList ? ' (waiting list open)' : ''}</span>
            <span>{received} / {cap}</span>
          </div>
          <Progress
            percent={Math.min(Math.round((received / cap) * 100), 100)}
            showInfo={false}
            size="small"
            status={item.applicationsLeft === 0 ? 'exception' : applicationsLow ? 'normal' : 'active'}
            strokeColor={applicationsLow ? token.colorWarning : undefined}
          />
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Pills + action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill token={token} tone={urgent || left === null ? 'error' : 'info'} icon={<FieldTimeOutlined />}>{deadlineText}</Pill>
        <Pill token={token} tone={item.seatsLeft === 0 || lowSeats ? 'error' : 'warning'} icon={<TeamOutlined />}>
          {item.seatsLeft === 0 ? 'Branch full' : `${item.seatsLeft}/${item.positions} positions left for your branch`}
        </Pill>
        <div style={{ marginLeft: 'auto' }}>
          {item.canApply ? (
            <Popconfirm
              title="Apply for this internship?"
              description="You can apply to up to 2 internships. Applications are considered in the order received. If one is approved, your other pending application is withdrawn automatically."
              okText="Apply"
              onConfirm={() => onApply(item)}
            >
              {applyButton}
            </Popconfirm>
          ) : (
            <Tooltip title={allReasons.length > 1 ? <div>{allReasons.map((m) => <div key={m}>• {m}</div>)}</div> : primaryReason}>
              <span>{applyButton}</span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* The "at most 2 internships" limit is explained by the Apply button tooltip only */}
      {!item.canApply && !item.applied && inlineReasons.length > 0 && (
        <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3, marginTop: -4 }}>
          <InfoCircleOutlined /> {inlineReasons[0].message}
          {inlineReasons.length > 1 && <> (+{inlineReasons.length - 1} more)</>}
        </Text>
      )}
    </Card>
  );
};

const BrowseOpportunities = () => {
  const [state, setState] = useState({
    loading: true, data: [], meta: { total: 0 }, profile: null,
    applications: [], applicationLimit: 2, pendingApplications: 0, hasConfirmedInternship: false,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [applyingId, setApplyingId] = useState(null);
  const debounced = useDebounce(search, 300);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await opportunityService.listEligible({ page, limit: PAGE_SIZE, search: debounced });
      setState({
        loading: false,
        data: res.data || [],
        meta: res.meta || { total: 0 },
        profile: res.profile,
        applications: res.applications || [],
        applicationLimit: res.applicationLimit ?? 2,
        pendingApplications: res.pendingApplications ?? 0,
        hasConfirmedInternship: !!res.hasConfirmedInternship,
      });
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

  const { loading, data, meta, profile, applicationLimit, pendingApplications, hasConfirmedInternship } = state;

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 4 }}>Internship Opportunities</Title>

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
      {hasConfirmedInternship ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message="You already have an internship, so you cannot apply for more."
          description={<Link to="/app/my-applications">View my internship</Link>}
        />
      ) : (
        pendingApplications > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`You have applied to ${pendingApplications} of ${applicationLimit} internships`}
            description={
              pendingApplications >= applicationLimit
                ? <>You have used all your applications. <Link to="/app/my-applications">View my applications</Link></>
                : <>You can apply to {applicationLimit - pendingApplications} more. <Link to="/app/my-applications">View my applications</Link></>
            }
          />
        )
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
          <Row gutter={[12, 12]}>
            {data.map((item) => (
              <Col key={item.id} xs={24} md={12} xl={8} xxl={6}>
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
