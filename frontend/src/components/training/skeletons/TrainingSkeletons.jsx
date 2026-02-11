import React from 'react';
import { Card, Col, Row, Skeleton } from 'antd';

/**
 * Skeleton loader for training stat cards
 */
export const TrainingStatSkeleton = () => (
  <Card className="rounded-2xl border-border shadow-none">
    <div className="flex items-center gap-4">
      <Skeleton.Avatar active size={44} shape="square" style={{ borderRadius: 12 }} />
      <div className="flex-1">
        <Skeleton.Input active size="small" style={{ width: 80, height: 14, marginBottom: 8 }} />
        <Skeleton.Input active size="small" style={{ width: 50, height: 28 }} />
      </div>
    </div>
  </Card>
);

/**
 * Skeleton loader for training cards (grid view)
 */
export const TrainingCardSkeleton = () => (
  <Card className="rounded-xl border-border shadow-none h-full" styles={{ body: { padding: 16 } }}>
    <div className="flex items-center justify-between mb-3">
      <Skeleton.Button active size="small" style={{ width: 70 }} />
      <Skeleton.Button active size="small" style={{ width: 80 }} />
    </div>
    <Skeleton.Input active style={{ width: '100%', height: 22, marginBottom: 8 }} />
    <Skeleton.Input active style={{ width: '80%', height: 16, marginBottom: 16 }} />
    <div className="space-y-3">
      <Skeleton.Input active style={{ width: '60%', height: 16 }} />
      <div className="flex justify-between">
        <Skeleton.Input active style={{ width: '40%', height: 16 }} />
        <Skeleton.Input active style={{ width: '30%', height: 16 }} />
      </div>
    </div>
    <div className="mt-4 pt-3 border-t border-border flex justify-between">
      <Skeleton.Input active style={{ width: '40%', height: 14 }} />
      <Skeleton.Input active style={{ width: '25%', height: 14 }} />
    </div>
  </Card>
);

/**
 * Skeleton loader for calendar view
 */
export const CalendarSkeleton = () => (
  <Card className="rounded-2xl border-border shadow-none overflow-hidden">
    <div className="flex justify-between items-center mb-4 pb-4 border-b border-border">
      <Skeleton.Input active style={{ width: 150, height: 24 }} />
      <div className="flex gap-2">
        <Skeleton.Button active size="small" />
        <Skeleton.Button active size="small" />
      </div>
    </div>
    <div className="grid grid-cols-7 gap-2 mb-2">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div key={day} className="text-center py-2">
          <Skeleton.Input active style={{ width: 30, height: 14 }} />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 35 }).map((_, idx) => (
        <div key={idx} className="aspect-square p-2 rounded-xl border border-border">
          <Skeleton.Input active style={{ width: 20, height: 14, marginBottom: 4 }} />
          {idx % 5 === 0 && <Skeleton.Input active style={{ width: '90%', height: 10 }} />}
        </div>
      ))}
    </div>
  </Card>
);

/**
 * Skeleton loader for selected day panel
 */
export const SelectedDaySkeleton = () => (
  <Card className="rounded-2xl border-border shadow-none">
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
      <div>
        <Skeleton.Input active style={{ width: 80, height: 12, marginBottom: 4 }} />
        <Skeleton.Input active style={{ width: 120, height: 20 }} />
      </div>
      <Skeleton.Avatar active size={40} shape="square" style={{ borderRadius: 12 }} />
    </div>
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <Card key={idx} className="rounded-xl border-border shadow-none" styles={{ body: { padding: 14 } }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Skeleton.Input active style={{ width: '80%', height: 16, marginBottom: 4 }} />
              <Skeleton.Input active style={{ width: '50%', height: 12 }} />
            </div>
            <Skeleton.Button active size="small" style={{ width: 60 }} />
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <Skeleton.Input active style={{ width: '60%', height: 14 }} />
          </div>
        </Card>
      ))}
    </div>
  </Card>
);

/**
 * Skeleton loader for training details page
 */
export const TrainingDetailsSkeleton = () => (
  <div className="p-6">
    <Skeleton.Button active style={{ width: 80, marginBottom: 16 }} />

    <Card className="rounded-2xl border-border shadow-none mb-6">
      <Row gutter={[24, 16]} align="middle">
        <Col xs={24} lg={16}>
          <div className="flex gap-2 mb-3">
            <Skeleton.Button active size="small" style={{ width: 80 }} />
            <Skeleton.Button active size="small" style={{ width: 100 }} />
          </div>
          <Skeleton.Input active style={{ width: '80%', height: 32, marginBottom: 8 }} />
          <Skeleton.Input active style={{ width: '40%', height: 18 }} />
        </Col>
        <Col xs={24} lg={8}>
          <Skeleton.Button active block style={{ height: 44 }} />
        </Col>
      </Row>
    </Card>

    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card className="rounded-xl border-border shadow-none mb-4">
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
        <Card className="rounded-xl border-border shadow-none mb-4">
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card className="rounded-xl border-border shadow-none mb-4">
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
        <Card className="rounded-xl border-border shadow-none">
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
      </Col>
    </Row>
  </div>
);

/**
 * Skeleton loader for application/certificate table rows
 */
export const TableRowSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, idx) => (
      <div key={idx} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/50">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <div key={colIdx} className="flex-1">
            <Skeleton.Input active style={{ width: colIdx === 0 ? '100%' : '80%', height: 16 }} />
          </div>
        ))}
        <Skeleton.Button active size="small" />
      </div>
    ))}
  </div>
);

/**
 * Skeleton loader for certificate cards
 */
export const CertificateCardSkeleton = () => (
  <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 16 } }}>
    <div className="flex items-start justify-between mb-4">
      <Skeleton.Avatar active size={48} shape="square" style={{ borderRadius: 12 }} />
      <Skeleton.Button active size="small" style={{ width: 70 }} />
    </div>
    <Skeleton.Input active style={{ width: '90%', height: 20, marginBottom: 4 }} />
    <Skeleton.Input active style={{ width: '60%', height: 14, marginBottom: 12 }} />
    <div className="space-y-2 mb-4">
      <Skeleton.Input active style={{ width: '70%', height: 14 }} />
      <Skeleton.Input active style={{ width: '50%', height: 14 }} />
    </div>
    <Skeleton.Button active block style={{ height: 36 }} />
  </Card>
);

/**
 * Skeleton loader for dashboard with greeting
 */
export const DashboardSkeleton = () => (
  <div className="p-6">
    {/* Header */}
    <div className="flex justify-between items-start mb-6">
      <div>
        <Skeleton.Input active style={{ width: 200, height: 28, marginBottom: 8 }} />
        <Skeleton.Input active style={{ width: 300, height: 18 }} />
      </div>
      <Skeleton.Button active style={{ width: 140, height: 40 }} />
    </div>

    {/* Banner */}
    <Card className="rounded-2xl border-border shadow-none mb-6">
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} lg={16}>
          <Skeleton.Input active style={{ width: '60%', height: 28, marginBottom: 8 }} />
          <Skeleton.Input active style={{ width: '80%', height: 18 }} />
        </Col>
        <Col xs={24} lg={8}>
          <Skeleton.Button active style={{ width: 150, height: 36 }} />
        </Col>
      </Row>
    </Card>

    {/* Stats */}
    <Row gutter={[16, 16]} className="mb-6">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Col xs={24} sm={12} lg={6} key={idx}>
          <TrainingStatSkeleton />
        </Col>
      ))}
    </Row>

    {/* Content Grid */}
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card className="rounded-xl border-border shadow-none">
          <div className="flex justify-between items-center mb-4">
            <Skeleton.Input active style={{ width: 150, height: 20 }} />
            <Skeleton.Input active style={{ width: 80, height: 16 }} />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/50">
                <div className="flex-1">
                  <Skeleton.Input active style={{ width: '70%', height: 16, marginBottom: 4 }} />
                  <Skeleton.Input active style={{ width: '50%', height: 14 }} />
                </div>
                <Skeleton.Button active size="small" />
              </div>
            ))}
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card className="rounded-xl border-border shadow-none">
          <Skeleton.Input active style={{ width: 140, height: 20, marginBottom: 16 }} />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton.Button active block key={idx} style={{ height: 48 }} />
            ))}
          </div>
        </Card>
      </Col>
    </Row>
  </div>
);

/**
 * Skeleton for lesson plan cards
 */
export const LessonPlanCardSkeleton = () => (
  <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 16 } }}>
    <div className="flex items-start justify-between mb-3">
      <Skeleton.Input active style={{ width: '70%', height: 18 }} />
      <Skeleton.Button active size="small" style={{ width: 80 }} />
    </div>
    <Skeleton.Input active style={{ width: '50%', height: 14, marginBottom: 8 }} />
    <Skeleton.Input active style={{ width: '40%', height: 14, marginBottom: 12 }} />
    <div className="flex gap-2">
      <Skeleton.Button active size="small" style={{ width: 70 }} />
      <Skeleton.Button active size="small" style={{ width: 70 }} />
    </div>
  </Card>
);

export default {
  TrainingStat: TrainingStatSkeleton,
  TrainingCard: TrainingCardSkeleton,
  Calendar: CalendarSkeleton,
  SelectedDay: SelectedDaySkeleton,
  TrainingDetails: TrainingDetailsSkeleton,
  TableRow: TableRowSkeleton,
  CertificateCard: CertificateCardSkeleton,
  Dashboard: DashboardSkeleton,
  LessonPlanCard: LessonPlanCardSkeleton,
};
