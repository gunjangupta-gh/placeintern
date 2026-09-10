import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Select, Tag, theme } from 'antd';
import { toast } from 'react-hot-toast';
import { SearchOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import DataTable from '../../../components/tables/DataTable';
import { internshipReportService } from '../../../services/internshipReport.service';
import { stateService } from '../../../services/state.service';

const { Search } = Input;

const InternshipReportOverview = () => {
  const { token } = theme.useToken();

  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', institutionId: '', district: '', page: 1, limit: 10 });

  const [institutions, setInstitutions] = useState([]);

  useEffect(() => {
    stateService
      .getInstitutions({ limit: 1000 })
      .then((res) => setInstitutions(res.data || res.institutions || []))
      .catch(() => toast.error('Failed to load institutions'));
  }, []);

  const districts = [...new Set(institutions.map((i) => i.district).filter(Boolean))];

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

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value ?? '', page: 1 }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await internshipReportService.exportReports({
        institutionId: filters.institutionId,
        district: filters.district,
      });
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

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
    { title: 'Institution', key: 'institution', render: (_, record) => record.institution?.name || '-' },
    { title: 'District', key: 'district', render: (_, record) => record.institution?.district || '-' },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName', ellipsis: true },
    {
      title: 'Mode',
      dataIndex: 'modeOfInternship',
      key: 'modeOfInternship',
      render: (mode) => (mode ? <Tag>{mode}</Tag> : '-'),
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
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: token.colorTextHeading, margin: 0 }}>
          Internship Reports — TPO Submission
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchReports} disabled={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
            Export for TPO Submission
          </Button>
        </div>
      </div>

      <Card style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Search
            placeholder="Search by student name, roll number, or company"
            allowClear
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: '100%', maxWidth: 320 }}
            prefix={<SearchOutlined style={{ color: token.colorTextDescription }} />}
          />
          <Select
            placeholder="Institution"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: '100%', maxWidth: 260 }}
            onChange={(value) => handleFilterChange('institutionId', value)}
            options={institutions.map((i) => ({ value: i.id, label: i.name }))}
          />
          <Select
            placeholder="District"
            allowClear
            style={{ width: '100%', maxWidth: 200 }}
            onChange={(value) => handleFilterChange('district', value)}
            options={districts.map((d) => ({ value: d, label: d }))}
          />
        </div>
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
    </div>
  );
};

export default InternshipReportOverview;
