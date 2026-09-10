import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Dropdown, Modal, Tag, theme } from 'antd';
import { toast } from 'react-hot-toast';
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import DataTable from '../../../components/tables/DataTable';
import { internshipReportService } from '../../../services/internshipReport.service';
import InternshipReportModal from './InternshipReportModal';

const { Search } = Input;

const InternshipReportList = () => {
  const { token } = theme.useToken();

  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', page: 1, limit: 10 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const response = await internshipReportService.getReports(filters);
      setList(response.data || []);
      setTotal(response.total || 0);
    } catch (error) {
      toast.error('Failed to load internship reports');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const handleOpenAdd = () => {
    setEditingReport(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingReport(record);
    setModalOpen(true);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Delete Internship Report',
      content: `Are you sure you want to delete the gathered internship report for ${record.student?.user?.name || 'this student'}?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await internshipReportService.deleteReport(record.id);
          toast.success('Internship report deleted');
          fetchReports();
        } catch (error) {
          toast.error(error?.response?.data?.message || 'Failed to delete report');
        }
      },
    });
  };

  const getActionMenuItems = (record) => [
    { key: 'edit', label: 'Edit', icon: <EditOutlined />, onClick: () => handleOpenEdit(record) },
    { type: 'divider' },
    { key: 'delete', label: 'Delete', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(record) },
  ];

  const columns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.student?.user?.name || '-'}</div>
          <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{record.student?.user?.rollNumber || '-'}</div>
        </div>
      ),
    },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName', ellipsis: true },
    {
      title: 'Mode',
      dataIndex: 'modeOfInternship',
      key: 'modeOfInternship',
      render: (mode) => (mode ? <Tag>{mode}</Tag> : '-'),
    },
    {
      title: 'Work Location',
      key: 'workLocation',
      render: (_, record) =>
        record.isWorkInPunjab === true
          ? `Punjab — ${record.workDistrict || '-'}`
          : record.isWorkInPunjab === false
          ? record.workState || '-'
          : '-',
    },
    {
      title: 'Stipend',
      key: 'stipend',
      render: (_, record) =>
        record.isStipendOffered ? `₹${record.stipendAmountPerMonth ?? '-'}/mo` : record.isStipendOffered === false ? 'No' : '-',
    },
    {
      title: 'Offer Letter',
      dataIndex: 'isOfferLetterReceived',
      key: 'isOfferLetterReceived',
      render: (val) => (val === true ? <Tag color="success">Received</Tag> : val === false ? <Tag>Pending</Tag> : '-'),
    },
    {
      title: 'Faculty Mentor',
      key: 'facultyMentor',
      render: (_, record) => record.facultyMentor?.name || '-',
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenuItems(record) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined style={{ fontSize: 18 }} />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: token.colorTextHeading, margin: 0 }}>
          Internship Reports (TPO Data)
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchReports} disabled={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd}>
            Add Report
          </Button>
        </div>
      </div>

      <Card
        style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}
        bodyStyle={{ padding: 16 }}
      >
        <Search
          placeholder="Search by student name, roll number, or company"
          allowClear
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ width: '100%', maxWidth: 340 }}
          prefix={<SearchOutlined style={{ color: token.colorTextDescription }} />}
        />
      </Card>

      <div style={{ backgroundColor: token.colorBgContainer, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          dataSource={list}
          loading={loading}
          rowKey="id"
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total,
            onChange: (page, pageSize) => setFilters((prev) => ({ ...prev, page, limit: pageSize })),
          }}
        />
      </div>

      <InternshipReportModal
        open={modalOpen}
        report={editingReport}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchReports}
      />
    </div>
  );
};

export default InternshipReportList;
