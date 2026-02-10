import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Row, Statistic, Table, Tag, message } from 'antd';
import { useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import {
  fetchStateTrainingCertificates,
  issueStateCertificate,
  bulkIssueStateCertificates,
  revokeStateCertificate,
} from '../store/stateTrainingSlice';

const CertificateManagementPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { certificates } = useSelector((state) => state.stateTraining);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateTrainingCertificates({ trainingId: id }));
  }, [dispatch, id]);

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
      render: (value) => (value ? <Tag color="green">Valid</Tag> : <Tag color="red">Revoked</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button size="small" danger onClick={() => handleRevoke(record.id)}>
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

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">Certificate Management</span>}
        description="Issue and manage certificates for this training."
      />

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Total" value={stats.total} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Valid" value={stats.valid} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Revoked" value={stats.revoked} />
          </Card>
        </Col>
      </Row>

      <Card className="rounded-2xl border-border shadow-none mb-6" title="Issue Certificates">
        <Form layout="vertical" form={form}>
          <Form.Item name="userId" label="Single User ID">
            <Input placeholder="User ID" />
          </Form.Item>
          <Form.Item name="userIds" label="Bulk User IDs (comma separated)">
            <Input.TextArea rows={2} placeholder="user-id-1, user-id-2" />
          </Form.Item>
          <Button type="primary" onClick={handleIssue}>Issue</Button>
        </Form>
      </Card>

      <Card className="rounded-2xl border-border shadow-none">
        <Table
          className="custom-table"
          rowKey="id"
          columns={columns}
          dataSource={certificates.list}
          loading={certificates.loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default CertificateManagementPage;
