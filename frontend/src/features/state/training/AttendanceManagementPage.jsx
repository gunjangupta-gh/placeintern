import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, DatePicker, Form, Input, Row, Statistic, Table, message } from 'antd';
import { useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { fetchStateTrainingAttendance, markStateBulkAttendance } from '../store/stateTrainingSlice';

const AttendanceManagementPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { attendance } = useSelector((state) => state.stateTraining);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateTrainingAttendance({ trainingId: id }));
  }, [dispatch, id]);

  const handleMarkAttendance = async () => {
    try {
      const values = await form.validateFields();
      const userIds = values.userIds
        .split(',')
        .map((val) => val.trim())
        .filter(Boolean);

      await dispatch(markStateBulkAttendance({
        trainingId: id,
        data: {
          userIds,
          attendanceDate: values.attendanceDate?.toISOString(),
        },
      })).unwrap();

      message.success('Attendance marked');
      form.resetFields();
      dispatch(fetchStateTrainingAttendance({ trainingId: id }));
    } catch (error) {
      message.error(error || 'Failed to mark attendance');
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
      title: 'Date',
      dataIndex: 'attendanceDate',
      key: 'attendanceDate',
      render: (value) => (value ? new Date(value).toLocaleDateString() : '-'),
    },
  ];

  const stats = useMemo(() => {
    const list = attendance.list || [];
    return {
      total: list.length,
      latest: list[0]?.attendanceDate,
    };
  }, [attendance.list]);

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">Attendance Management</span>}
        description="Record and review attendance for this training."
      />

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Attendance Records" value={stats.total} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic
              title="Latest Entry"
              value={
                stats.latest
                  ? new Date(stats.latest).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A'
              }
            />
          </Card>
        </Col>
      </Row>

      <Card className="rounded-2xl border-border shadow-none mb-6" title="Bulk Mark Attendance">
        <Form layout="vertical" form={form}>
          <Form.Item
            name="userIds"
            label="User IDs (comma separated)"
            rules={[{ required: true, message: 'Enter at least one user ID' }]}
          >
            <Input.TextArea rows={3} placeholder="user-id-1, user-id-2" />
          </Form.Item>
          <Form.Item name="attendanceDate" label="Attendance Date">
            <DatePicker className="w-full" />
          </Form.Item>
          <Button type="primary" onClick={handleMarkAttendance}>Mark Attendance</Button>
        </Form>
      </Card>

      <Card className="rounded-2xl border-border shadow-none">
        <Table
          className="custom-table"
          rowKey="id"
          columns={columns}
          dataSource={attendance.list}
          loading={attendance.loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default AttendanceManagementPage;
