import React from 'react';
import { useSelector } from 'react-redux';
import {
  Modal,
  Table,
  Typography,
  Tag,
  Empty,
  Button,
  theme
} from 'antd';
import {
  selectJoiningLettersByMentor,
  selectJoiningLettersByMentorLoading,
} from '../../store/principalSlice';

const { Text } = Typography;

const JoiningLettersModal = ({
  visible,
  onClose,
}) => {
  const joiningLettersData = useSelector(selectJoiningLettersByMentor);
  const loading = useSelector(selectJoiningLettersByMentorLoading);
  const { token } = theme.useToken();

  const byMentor = joiningLettersData?.byMentor || [];
  const totalStudents = joiningLettersData?.totalStudents || 0;
  const totalPending = joiningLettersData?.totalPending || 0;

  const columns = [
    {
      title: 'Faculty Mentor',
      dataIndex: 'mentorName',
      key: 'mentorName',
      render: (text, record) => (
        <Tag
          bordered={false}
          style={{
            color: record.isUnassigned ? token.colorError : token.colorText,
            backgroundColor: record.isUnassigned ? token.colorErrorBg : 'transparent',
            borderColor: record.isUnassigned ? token.colorErrorBorder : 'transparent',
            fontWeight: record.isUnassigned ? 600 : 400,
            border: record.isUnassigned ? `1px solid ${token.colorErrorBorder}` : 'none',
          }}
        >
          {text}
        </Tag>
      ),
    },
    {
      title: 'Students with Internship',
      dataIndex: 'studentsWithInternship',
      key: 'studentsWithInternship',
      align: 'center',
      render: (count, record) => (
        <Tag
          bordered={false}
          style={{
            minWidth: '40px',
            textAlign: 'center',
            color: record.isUnassigned ? token.colorWarningText : token.colorPrimaryText,
            backgroundColor: record.isUnassigned ? token.colorWarningBg : token.colorPrimaryBg,
          }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.studentsWithInternship - b.studentsWithInternship,
    },
    {
      title: 'Pending',
      dataIndex: 'pendingLetters',
      key: 'pendingLetters',
      align: 'center',
      render: (count) => (
        <Tag
          bordered={false}
          style={{
            minWidth: '40px',
            textAlign: 'center',
            backgroundColor: count > 0 ? token.colorErrorBg : token.colorSuccessBg,
            color: count > 0 ? token.colorErrorText : token.colorSuccessText,
          }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.pendingLetters - b.pendingLetters,
    },
    {
      title: 'Total',
      dataIndex: 'totalLetters',
      key: 'totalLetters',
      align: 'center',
      render: (count) => (
        <Tag
          bordered={false}
          style={{
            minWidth: '40px',
            textAlign: 'center',
            backgroundColor: token.colorInfoBg,
            color: token.colorInfoText,
          }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.totalLetters - b.totalLetters,
    },
  ];

  return (
    <Modal
      title="Joining Report Overview"
      open={visible}
      onCancel={onClose}
      centered
      destroyOnClose
      transitionName=""
      maskTransitionName=""
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
      width={900}
      styles={{ body: { padding: '24px' } }}
    >
      {/* Summary Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          marginBottom: 24,
          borderRadius: token.borderRadiusLG,
          backgroundColor: token.colorInfoBg,
          border: `1px solid ${token.colorInfoBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Total Students:</Text>
          <Tag bordered={false} style={{ fontSize: '14px', padding: '2px 12px', color: token.colorPrimaryText, backgroundColor: token.colorPrimaryBg }}>
            {totalStudents}
          </Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Pending:</Text>
          <Tag
            bordered={false}
            style={{
              fontSize: '14px',
              padding: '2px 12px',
              backgroundColor: totalPending > 0 ? token.colorErrorBg : token.colorSuccessBg,
              color: totalPending > 0 ? token.colorErrorText : token.colorSuccessText,
              border: `1px solid ${totalPending > 0 ? token.colorErrorBorder : token.colorSuccessBorder}`,
            }}
          >
            {totalPending}
          </Tag>
        </div>
      </div>

      {/* Faculty Table */}
      <Table
        dataSource={byMentor}
        columns={columns}
        rowKey="mentorId"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} mentors`,
        }}
        size="small"
        locale={{
          emptyText: <Empty description="No joining report data available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        }}
      />
    </Modal>
  );
};

export default JoiningLettersModal;
