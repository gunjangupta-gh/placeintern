import React, { useState } from 'react';
import { Alert, Button, Card, Space, Statistic, Steps, Tag, Typography, Upload } from 'antd';
import { AppTable } from '../../../components/ui';
import { ArrowLeftOutlined, CheckCircleOutlined, DownloadOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-hot-toast';
import { bulkService } from '../../../services/bulk.service';
import { fetchMentorAssignments, fetchMentorStats } from '../store/principalSlice';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

const STATUS = {
  ASSIGN: { color: 'green', label: 'New assignment' },
  REASSIGN: { color: 'blue', label: 'Change mentor' },
  UNCHANGED: { color: 'default', label: 'No change' },
  ERROR: { color: 'red', label: 'Error' },
};

const errMessage = (e, fallback) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || e?.message || fallback;
};

/** Principal: assign mentors to many students from one Excel file (check first, then save). */
const BulkMentorAssignment = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [file, setFile] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // dryRun result, then the saved result
  const [filter, setFilter] = useState('ALL');

  const step = result ? (result.dryRun ? 1 : 2) : 0;

  const downloadTemplate = async () => {
    try {
      const blob = await bulkService.downloadMentorAssignmentTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bulk-mentor-assignment-template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errMessage(e, 'Failed to download template'));
    }
  };

  const reset = () => { setFile(null); setResult(null); setFilter('ALL'); };

  const check = async (f) => {
    setChecking(true);
    try {
      setResult(await bulkService.validateMentorAssignments(f));
      setFilter('ALL');
    } catch (e) {
      toast.error(errMessage(e, 'Could not check the file'));
      setFile(null);
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await bulkService.uploadMentorAssignments(file);
      setResult(res);
      setFilter('ALL');
      toast.success(`${res.willAssign} student(s) assigned`);
      // keep the Mentor Assignment screen fresh
      dispatch(fetchMentorAssignments({ forceRefresh: true }));
      dispatch(fetchMentorStats({ forceRefresh: true }));
    } catch (e) {
      toast.error(errMessage(e, 'Assignment failed'));
    } finally {
      setSaving(false);
    }
  };

  const rows = (result?.rows || []).filter((r) => filter === 'ALL' || r.status === filter);

  const columns = [
    { title: 'Row', dataIndex: 'row', width: 70 },
    { title: 'Roll Number', dataIndex: 'rollNumber' },
    { title: 'Student', dataIndex: 'studentName' },
    { title: 'Current mentor', dataIndex: 'currentMentor', render: (v) => v || '-' },
    { title: 'New mentor', render: (_, r) => r.mentorName || r.mentorEmail || '-' },
    {
      title: 'Result',
      dataIndex: 'status',
      render: (s, r) => (
        <div>
          <Tag color={STATUS[s].color}>{STATUS[s].label}</Tag>
          {r.error && <div><Text type="danger" style={{ fontSize: 12 }}>{r.error}</Text></div>}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen space-y-6">
      <div>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/mentors')} style={{ paddingLeft: 0 }}>
          Back to Mentor Assignments
        </Button>
        <Title level={3} style={{ margin: 0 }}>Bulk Mentor Assignment</Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Assign mentors to many students at once from an Excel file. Nothing is saved until you confirm.
        </Paragraph>
      </div>

      <Steps
        current={step}
        items={[{ title: 'Upload file' }, { title: 'Check rows' }, { title: 'Done' }]}
      />

      {!result && (
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="How it works"
              description={
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Download the template. It already lists your active students and your mentors.</li>
                  <li>Fill the <b>Mentor Email</b> column for the students you want to assign (copy it from the Mentors sheet).</li>
                  <li>Upload the file. You will see every row checked before anything is saved.</li>
                </ol>
              }
            />
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>Download template</Button>
            <Dragger
              accept=".xlsx,.xls,.csv"
              maxCount={1}
              multiple={false}
              disabled={checking}
              fileList={file ? [{ uid: '-1', name: file.name, status: checking ? 'uploading' : 'done' }] : []}
              beforeUpload={(f) => {
                if (f.size > 5 * 1024 * 1024) { toast.error('File must be smaller than 5MB'); return Upload.LIST_IGNORE; }
                setFile(f);
                check(f);
                return false;
              }}
              onRemove={reset}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Click or drag the filled Excel file here</p>
              <p className="ant-upload-hint">.xlsx or .csv, up to 2000 rows</p>
            </Dragger>
          </Space>
        </Card>
      )}

      {result && (
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {result.dryRun ? (
              <Alert
                type={result.willAssign ? 'success' : 'warning'}
                showIcon
                message={result.willAssign
                  ? `${result.willAssign} student(s) ready to assign${result.failed ? `; ${result.failed} row(s) have errors and will be skipped` : ''}`
                  : 'Nothing to assign. Fix the errors in your file and upload it again.'}
              />
            ) : (
              <Alert type="success" showIcon icon={<CheckCircleOutlined />} message={`Saved: ${result.willAssign} student(s) assigned${result.failed ? `, ${result.failed} row(s) skipped` : ''}.`} />
            )}

            <Space size="large" wrap>
              <Statistic title="Rows" value={result.total} />
              <Statistic title="New" value={result.newAssignments} valueStyle={{ color: '#3f8600' }} />
              <Statistic title="Mentor changed" value={result.reassignments} valueStyle={{ color: '#1677ff' }} />
              <Statistic title="No change" value={result.unchanged} />
              <Statistic title="Errors" value={result.failed} valueStyle={result.failed ? { color: '#cf1322' } : undefined} />
            </Space>

            <Space wrap>
              {['ALL', 'ERROR', 'ASSIGN', 'REASSIGN', 'UNCHANGED'].map((k) => (
                <Button key={k} size="small" type={filter === k ? 'primary' : 'default'} onClick={() => setFilter(k)}>
                  {k === 'ALL' ? 'All' : STATUS[k].label}
                </Button>
              ))}
            </Space>

            <AppTable rowKey="row" size="small" dataSource={rows} columns={columns} />

            <Space>
              {result.dryRun && (
                <Button type="primary" icon={<UploadOutlined />} loading={saving} disabled={!result.willAssign} onClick={save}>
                  Assign {result.willAssign} student(s)
                </Button>
              )}
              <Button onClick={reset}>{result.dryRun ? 'Cancel' : 'Upload another file'}</Button>
              {!result.dryRun && <Button type="primary" onClick={() => navigate('/app/mentors')}>View assignments</Button>}
            </Space>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default BulkMentorAssignment;
