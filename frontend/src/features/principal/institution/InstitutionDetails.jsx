import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Button, Spin, Alert, Card, Typography, theme } from 'antd';
import { toast } from 'react-hot-toast';
import { SaveOutlined, EditOutlined, ReloadOutlined, CloseOutlined } from '@ant-design/icons';
import principalService from '../../../services/principal.service';
import InstitutionFormTabs from '../../shared/institution/InstitutionFormTabs';
import InstitutionProfileView from './InstitutionProfileView';
import {
  buildInstitutionFormValues,
  buildPrincipalInstitutionPayload,
  normalizeLookupList,
  sanitizeBranchIntakeRows,
  sanitizeStaffCapacityRows,
} from '../../shared/institution/institutionFormUtils';

const { Title, Text } = Typography;

/**
 * Principal "My Institution" page. Shows a read-only profile; "Edit" switches
 * to the form for the principal's OWN institution. The institution is resolved
 * server-side from the login, and the server only accepts an allow-list of
 * fields, so code / type / status / capacity totals stay state-only (shown
 * read-only in the form).
 */
const InstitutionDetails = () => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('basic');

  const [institution, setInstitution] = useState(null);
  const [intakes, setIntakes] = useState([]);
  const [staffCapacities, setStaffCapacities] = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);
  const [batchOptions, setBatchOptions] = useState([]);

  // Snapshot of what the form was loaded with, used to only re-save intake /
  // staff rows when they actually changed and to keep existing covered-area rows.
  const initialRef = useRef({ intakes: '[]', staff: '[]', entityTypes: [] });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Everything must load before the page is usable: saving a form built
      // from defaults could otherwise overwrite real data with empty rows.
      const [institutionRes, intakesRes, staffRes, branchesRes, batchesRes] = await Promise.all([
        principalService.getInstitution(),
        principalService.getInstitutionBranchIntakes(),
        principalService.getInstitutionBranchStaffCapacities(),
        principalService.getOwnBranches(),
        principalService.getOwnBatches(),
      ]);

      setInstitution(institutionRes?.data || institutionRes);
      setIntakes(normalizeLookupList(intakesRes, 'intakes'));
      setStaffCapacities(normalizeLookupList(staffRes, 'capacities'));
      setBranchOptions(
        normalizeLookupList(branchesRes, 'branches').map((branch) => ({
          label: branch.code ? `${branch.name} (${branch.code})` : branch.name,
          value: branch.id,
        })),
      );
      setBatchOptions(
        normalizeLookupList(batchesRes, 'batches').map((batch) => ({ label: batch.name, value: batch.id })),
      );
    } catch (error) {
      setLoadError(error?.message || 'Failed to load institution details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Populate the form each time edit mode opens (the <Form> mounts with it).
  useEffect(() => {
    if (!editing || !institution) return;
    const formValues = buildInstitutionFormValues({
      ...institution,
      branchIntakes: intakes,
      staffCapacities,
    });
    form.resetFields();
    form.setFieldsValue(formValues);
    initialRef.current = {
      intakes: JSON.stringify(sanitizeBranchIntakeRows(formValues.branchIntakes)),
      staff: JSON.stringify(sanitizeStaffCapacityRows(formValues.staffCapacities)),
      entityTypes: (institution.coveredAreaDetails || []).map((row) => row.entityType),
    };
    setActiveFormTab('basic');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const handleEdit = () => setEditing(true);

  const handleCancel = () => {
    form.resetFields();
    setEditing(false);
  };

  const handleSave = async () => {
    try {
      await form.validateFields();
    } catch {
      toast.error('Please fix the highlighted fields');
      return;
    }

    setSubmitting(true);
    try {
      // getFieldsValue(true) returns the whole form store, including tabs the
      // user never opened (antd renders tabs lazily). Using onFinish values
      // here would drop those fields and null them out on the server.
      const values = form.getFieldsValue(true);

      await principalService.updateInstitution(
        buildPrincipalInstitutionPayload(values, initialRef.current.entityTypes),
      );

      const intakePayload = sanitizeBranchIntakeRows(values.branchIntakes || []);
      if (JSON.stringify(intakePayload) !== initialRef.current.intakes) {
        await principalService.replaceInstitutionBranchIntakes(intakePayload);
      }

      const staffPayload = sanitizeStaffCapacityRows(values.staffCapacities || []);
      if (JSON.stringify(staffPayload) !== initialRef.current.staff) {
        await principalService.replaceInstitutionBranchStaffCapacities(staffPayload);
      }

      toast.success('Institution details updated successfully');
      setEditing(false);
      await load();
    } catch (error) {
      console.error('Institution update error:', error);
      toast.error(error?.message || 'Failed to update institution details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="p-4 md:p-6 min-h-screen overflow-y-auto hide-scrollbar"
      style={{ backgroundColor: token.colorBgLayout }}
    >
      <div className="max-w-7xl mx-auto !space-y-4 pb-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <Title level={3} className="!mb-0 !text-xl font-semibold" style={{ color: token.colorText }}>
              My Institution
            </Title>
          </div>
          {!loading && !loadError && (
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button icon={<CloseOutlined />} onClick={handleCancel} disabled={submitting} size="small" className="rounded-lg text-xs font-medium">
                    Cancel
                  </Button>
                  <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={submitting} size="small" className="rounded-lg text-xs font-medium">
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button type="primary" icon={<EditOutlined />} onClick={handleEdit} size="small" className="rounded-lg text-xs font-medium">
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20"><Spin size="large" /></div>
        ) : loadError ? (
          <Alert
            type="error"
            showIcon
            message="Could not load your institution details"
            description={loadError}
            action={<Button size="small" icon={<ReloadOutlined />} onClick={load}>Retry</Button>}
          />
        ) : editing ? (
          <Card
            variant="borderless"
            className="rounded-xl shadow-sm border"
            style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorderSecondary }}
            styles={{ body: { padding: '20px' } }}
          >
            <style>{`
              .compact-institution-form .ant-form-item { margin-bottom: 8px; }
              .compact-institution-form .ant-tabs-nav { margin-bottom: 12px !important; }
              .compact-institution-form .ant-tabs-tab { padding-top: 4px; padding-bottom: 4px; }
              .compact-institution-form .ant-input,
              .compact-institution-form .ant-select-selector,
              .compact-institution-form .ant-picker { min-height: 32px !important; height: 32px !important; }
              .compact-institution-form textarea.ant-input { min-height: 56px !important; height: auto !important; }
            `}</style>
            <Form
              form={form}
              layout="vertical"
              noValidate
              requiredMark={false}
              size="small"
              className="institution-form compact-institution-form"
            >
              <InstitutionFormTabs
                mode="principal"
                isEditMode
                activeFormTab={activeFormTab}
                onTabChange={setActiveFormTab}
                branchOptions={branchOptions}
                batchOptions={batchOptions}
              />
            </Form>
          </Card>
        ) : (
          <InstitutionProfileView
            institution={institution}
            intakes={intakes}
            staffCapacities={staffCapacities}
          />
        )}
      </div>
    </div>
  );
};

export default InstitutionDetails;
