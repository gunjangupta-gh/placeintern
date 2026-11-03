import React, { useState } from 'react';
import { Alert, Button, Card, Checkbox, Space, Statistic, Table, Tag, Typography, Upload } from 'antd';
import { CheckCircleOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { opportunityService, getErrorMessage, formatDate } from '../../../services/opportunity.service';

const { Dragger } = Upload;
const { Text } = Typography;

const previewColumns = [
  { title: 'Row', dataIndex: 'row', width: 60 },
  { title: 'Company', dataIndex: 'company' },
  { title: 'Position', dataIndex: 'title' },
  { title: 'District', dataIndex: 'district' },
  { title: 'Positions', dataIndex: 'positions', width: 90 },
  { title: 'Branches', dataIndex: 'branchCodes', render: (codes) => codes.map((c) => <Tag key={c}>{c}</Tag>) },
  { title: 'Years', dataIndex: 'eligibleYears', render: (y) => (y?.length ? y.join(', ') : 'All') },
  { title: 'Duration', dataIndex: 'durationMonths', render: (m) => `${m} mo` },
  { title: 'Deadline', dataIndex: 'applicationDeadline', render: formatDate },
  { title: 'Start', dataIndex: 'startDate', render: formatDate },
];

const OpportunityUpload = ({ onImported }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(false);

  const reset = () => { setFile(null); setPreview(null); setSkipInvalid(false); };

  const downloadTemplate = async () => {
    try {
      const blob = await opportunityService.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'internship-opportunities-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to download template'));
    }
  };

  const validate = async (f) => {
    setBusy(true);
    setPreview(null);
    try {
      setPreview(await opportunityService.previewImport(f));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not read the file'));
      setFile(null);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await opportunityService.confirmImport(file, skipInvalid);
      toast.success(`${res.imported} opportunit${res.imported === 1 ? 'y' : 'ies'} published${res.skipped ? `, ${res.skipped} row(s) skipped` : ''}`);
      reset();
      onImported?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Import failed'));
    } finally {
      setBusy(false);
    }
  };

  const canConfirm = preview && preview.validRows > 0 && (preview.invalidRows === 0 || skipInvalid);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>Download template</Button>
          <Text type="secondary">One row per position. Branch codes come from the template's "Branches" sheet. Nothing is saved until you confirm.</Text>
        </Space>
      </Card>

      <Dragger
        accept=".xlsx"
        maxCount={1}
        multiple={false}
        disabled={busy}
        showUploadList={!!file}
        fileList={file ? [{ uid: '1', name: file.name, status: 'done' }] : []}
        beforeUpload={(f) => { setFile(f); validate(f); return false; }}
        onRemove={reset}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Click or drag the filled .xlsx template here</p>
        <p className="ant-upload-hint">Maximum 500 rows, 5 MB</p>
      </Dragger>

      {preview && (
        <Card
          title="Preview"
          loading={busy && !preview}
          extra={<Button onClick={reset} disabled={busy}>Cancel</Button>}
        >
          <Space size={32} style={{ marginBottom: 16 }}>
            <Statistic title="Rows read" value={preview.totalRows} />
            <Statistic title="Valid" value={preview.validRows} valueStyle={{ color: '#3f8600' }} />
            <Statistic title="With errors" value={preview.invalidRows} valueStyle={{ color: preview.invalidRows ? '#cf1322' : undefined }} />
            <Statistic title="New companies" value={preview.newCompanies.length} />
          </Space>

          {preview.newCompanies.length > 0 && (
            <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`New companies will be created: ${preview.newCompanies.join(', ')}`} />
          )}

          {preview.invalidRows > 0 && (
            <>
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
                message="Some rows have errors. Fix them in the file and upload again, or skip them."
              />
              <Table
                size="small"
                rowKey="row"
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                dataSource={preview.errors}
                columns={[
                  { title: 'Row', dataIndex: 'row', width: 70 },
                  { title: 'Problems', dataIndex: 'messages', render: (m) => <ul style={{ margin: 0, paddingLeft: 18 }}>{m.map((x) => <li key={x}>{x}</li>)}</ul> },
                ]}
                style={{ marginBottom: 16 }}
              />
              <Checkbox checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} style={{ marginBottom: 16 }}>
                Skip the {preview.invalidRows} invalid row(s) and import the rest
              </Checkbox>
            </>
          )}

          {preview.validRows > 0 && (
            <Table
              size="small"
              rowKey="row"
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              dataSource={preview.rows}
              columns={previewColumns}
              title={() => <Text strong>Rows that will be published</Text>}
            />
          )}

          <div style={{ marginTop: 16 }}>
            <Button type="primary" icon={<CheckCircleOutlined />} disabled={!canConfirm} loading={busy} onClick={confirm}>
              Confirm and publish {preview.validRows} opportunit{preview.validRows === 1 ? 'y' : 'ies'}
            </Button>
          </div>
        </Card>
      )}
    </Space>
  );
};

export default OpportunityUpload;
