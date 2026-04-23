import React, { useMemo } from 'react';
import { Card, Empty, Table, Typography } from 'antd';

const { Text } = Typography;

const asNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const CourseWiseFacultyTable = ({ rows = [], loading = false }) => {
  const normalizedRows = useMemo(
    () =>
      (Array.isArray(rows) ? rows : []).map((item, index) => ({
        ...item,
        course: item?.course || item?.courseName || `Course ${index + 1}`,
        facultyCount: asNumber(item?.facultyCount ?? item?.faculty_count),
        completedTrainingsCount: asNumber(
          item?.completedTrainingsCount ??
            item?.completedTrainingCount ??
            item?.completedTrainings ??
            item?.completed_count
        ),
        feedbackSubmittedCount: asNumber(
          item?.feedbackSubmittedCount ??
            item?.feedbackSubmissionCount ??
            item?.feedbackSubmitted ??
            item?.feedback_count
        ),
      })),
    [rows]
  );

  const columns = [
    {
      title: 'Course',
      dataIndex: 'course',
      key: 'course',
      render: (value) => <Text className="text-xs">{value}</Text>,
    },
    {
      title: 'No. of Faculty',
      dataIndex: 'facultyCount',
      key: 'facultyCount',
      width: 140,
      render: (value) => <Text className="text-xs font-semibold">{value}</Text>,
    },
    {
      title: 'Completed Trainings',
      dataIndex: 'completedTrainingsCount',
      key: 'completedTrainingsCount',
      width: 170,
      render: (value) => <Text className="text-xs font-semibold">{value ?? 0}</Text>,
    },
    {
      title: 'Feedback Submitted',
      dataIndex: 'feedbackSubmittedCount',
      key: 'feedbackSubmittedCount',
      width: 160,
      render: (value) => <Text className="text-xs font-semibold">{value ?? 0}</Text>,
    },
  ];

  return (
    <Card
      className="rounded-xl border border-gray-100 shadow-sm bg-white"
      styles={{ body: { padding: '12px' } }}
      title={
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Course Wise No. of Faculty
        </Text>
      }
      loading={loading}
    >
      {normalizedRows.length > 0 ? (
        <Table
          rowKey="course"
          columns={columns}
          dataSource={normalizedRows}
          size="small"
          pagination={false}
          scroll={{ x: 680 }}
        />
      ) : (
        <Empty description="No course-wise faculty data" className="my-4!" />
      )}
    </Card>
  );
};

export default CourseWiseFacultyTable;