import React, { useEffect, useState } from 'react';
import { Card, Col, Progress, Row, Skeleton, Statistic, Table, Typography, theme } from 'antd';
import { AppTable, AppModal } from '../../../components/ui';
import { EyeOutlined } from '@ant-design/icons';
import { opportunityService } from '../../../services/opportunity.service';

const { Text } = Typography;

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const Title = ({ children }) => (
  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{children}</Text>
);

/**
 * Four headline cards for the State Directorate (published internships only):
 * total internships (branch-wise split in a modal behind the eye icon), average stipend, applications, selected.
 */
const OpportunityStats = ({ refreshKey }) => {
  const { token } = theme.useToken();
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);
  const [showBranches, setShowBranches] = useState(false);

  useEffect(() => {
    let cancelled = false;
    opportunityService.stats()
      .then((s) => { if (!cancelled) { setStats(s); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (failed && !stats) return null; // the numbers are a convenience, never block the page
  if (!stats) {
    return <Row gutter={[12, 12]} style={{ marginBottom: 16 }}><Col span={24}><Card size="small"><Skeleton active paragraph={{ rows: 1 }} /></Card></Col></Row>;
  }

  const pct = stats.vacancies ? Math.round((stats.selected / stats.vacancies) * 100) : 0;
  const cardStyle = { height: '100%', borderRadius: 12 };

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {/* 1. Total internships (branch-wise split is in the eye-icon modal) */}
      <Col xs={24} sm={12} xl={6}>
        <Card size="small" style={{ ...cardStyle, position: 'relative' }}>
          <button
            type="button"
            aria-label="View branch-wise internships"
            title="View branch-wise internships"
            onClick={() => setShowBranches(true)}
            style={{
              position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: '50%', border: 'none',
              background: 'transparent', color: token.colorTextQuaternary, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = token.colorFillSecondary; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <EyeOutlined style={{ fontSize: 12 }} />
          </button>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', paddingRight: 24 }}>
            <div style={{ minWidth: 110 }}>
              <Title>Total internships</Title>
              <Statistic value={stats.vacancies} valueStyle={{ fontSize: 32, fontWeight: 600 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {stats.opportunities} opportunit{stats.opportunities === 1 ? 'y' : 'ies'} · {stats.openOpportunities} open
              </Text>
            </div>
          </div>
        </Card>
      </Col>

      {/* 2. Average stipend */}
      <Col xs={24} sm={12} xl={6}>
        <Card size="small" style={cardStyle}>
          <Title>Average stipend</Title>
          {stats.averageStipend === null ? (
            <Statistic value="-" valueStyle={{ fontSize: 28, fontWeight: 600 }} />
          ) : (
            <Statistic value={rupees(stats.averageStipend)} suffix={<span style={{ fontSize: 13, color: token.colorTextSecondary }}>/ month</span>} valueStyle={{ fontSize: 28, fontWeight: 600 }} />
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {stats.stipendCoverage.counted
              ? `Based on ${stats.stipendCoverage.counted} of ${stats.stipendCoverage.total} internships with a stipend`
              : 'No stipend entered yet'}
          </Text>
        </Card>
      </Col>

      {/* 3. Applications */}
      <Col xs={24} sm={12} xl={6}>
        <Card size="small" style={cardStyle}>
          <Title>Applications</Title>
          <Statistic value={stats.applications.received} valueStyle={{ fontSize: 28, fontWeight: 600 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{stats.applications.waiting} waiting for a decision</Text>
        </Card>
      </Col>

      {/* 4. Selected students */}
      <Col xs={24} sm={12} xl={6}>
        <Card size="small" style={cardStyle}>
          <Title>Selected students</Title>
          <Statistic value={stats.selected} suffix={<span style={{ fontSize: 13, color: token.colorTextSecondary }}>/ {stats.vacancies}</span>} valueStyle={{ fontSize: 28, fontWeight: 600, color: token.colorSuccess }} />
          <Progress percent={pct} size="small" showInfo={false} strokeColor={token.colorSuccess} style={{ marginBottom: 0 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{stats.vacanciesLeft} internships left ({pct}% filled)</Text>
        </Card>
      </Col>

      <AppModal
        open={showBranches}
        title="Branch-wise internships"
        footer={null}
        width={760}
        onCancel={() => setShowBranches(false)}
        destroyOnHidden
      >
        <AppTable
          size="small"
          rowKey="code"
          pagination={false}
          dataSource={stats.branchWise}
          locale={{ emptyText: 'No internships yet' }}
          scroll={{ y: 360 }}
          columns={[
            { title: 'Branch', render: (_, b) => <span style={{ whiteSpace: 'nowrap' }}>{b.name} <Text type="secondary">({b.code})</Text></span> },
            { title: 'Internships', dataIndex: 'positions', align: 'right', sorter: (a, b) => a.positions - b.positions },
            { title: 'Selected', dataIndex: 'selected', align: 'right', render: (n) => <Text style={{ color: token.colorSuccess }}>{n}</Text> },
            {
              title: 'Left',
              align: 'right',
              render: (_, b) => {
                const left = Math.max(b.positions - b.selected, 0);
                return <Text type={left === 0 ? 'danger' : undefined}>{left}</Text>;
              },
            },
            {
              title: 'Share',
              align: 'right',
              render: (_, b) => (stats.vacancies ? `${Math.round((b.positions / stats.vacancies) * 100)}%` : '-'),
            },
          ]}
          summary={() =>
            stats.branchWise.length > 0 && (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><b>Total</b></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><b>{stats.vacancies}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right"><b>{stats.selected}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right"><b>{stats.vacanciesLeft}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right"><b>100%</b></Table.Summary.Cell>
              </Table.Summary.Row>
            )
          }
        />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          Published internships only (open and filled).
        </Text>
      </AppModal>
    </Row>
  );
};

export default OpportunityStats;
