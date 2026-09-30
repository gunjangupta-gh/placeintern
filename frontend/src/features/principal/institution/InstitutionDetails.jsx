import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Button, Spin, Alert, Card } from 'antd';
import { toast } from 'react-hot-toast';
import { SaveOutlined, BankOutlined, ReloadOutlined } from '@ant-design/icons';
import principalService from '../../../services/principal.service';
import InstitutionFormTabs from '../../shared/institution/InstitutionFormTabs';
import {
  buildInstitutionFormValues,
  buildPrincipalInstitutionPayload,
  normalizeLookupList,
  sanitizeBranchIntakeRows,
  sanitizeStaffCapacityRows,
} from '../../shared/institution/institutionFormUtils';

/**
 * Principal "My Institution" page: edit the details of the principal's OWN
 * institution. The institution is resolved server-side from the login, and the
 * server only accepts an allow-list of fields, so code / type / status /
 * capacity totals stay state-only (shown read-only here).
 */
const InstitutionDetails = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('basic');
  const [branchOptions, setBranchOptions] = useState([]);
  const [batchOptions, setBatchOptions] = useState([]);

  // Snapshots of what was loaded, used to (a) only re-save intake / staff rows
  // when they actually changed and (b) keep covered-area rows that already exist.
  const initialRef = useRef({ intakes: '[]', staff: '[]', entityTypes: [] });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Everything must load before the form is editable: saving a form built
      // from defaults could otherwise overwrite real data with empty rows.
      const [institution, intakes, staffCapacities, branches, batches] = await Promise.all([
        principalService.getInstitution(),
        principalService.getInstitutionBranchIntakes(),
        principalService.getInstitutionBranchStaffCapacities(),
        principalService.getOwnBranches(),
        principalService.getOwnBatches(),
      ]);

      const institutionData = institution?.data || institution;
      const intakeRows = normalizeLookupList(intakes, 'intakes');
      const staffRows = normalizeLookupList(staffCapacities, 'capacities');

      setBranchOptions(
        normalizeLookupList(branches, 'branches').map((branch) => ({
          label: branch.code ? `${branch.name} (${branch.code})` : branch.name,
          value: branch.id,
        })),
      );
      setBatchOptions(
        normalizeLookupList(batches, 'batches').map((batch) => ({ label: batch.name, value: batch.id })),
      );

      const formValues = buildInstitutionFormValues({
        ...institutionData,
        branchIntakes: intakeRows,
        staffCapacities: staffRows,
      });
      form.resetFields();
      form.setFieldsValue(formValues);

      initialRef.current = {
        intakes: JSON.stringify(sanitizeBranchIntakeRows(formValues.branchIntakes)),
        staff: JSON.stringify(sanitizeStaffCapacityRows(formValues.staffCapacities)),
        entityTypes: (institutionData?.coveredAreaDetails || []).map((row) => row.entityType),
      };
    } catch (error) {
      setLoadError(error?.message || 'Failed to load institution details');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    load();
  }, [load]);

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
      await load();
    } catch (error) {
      console.error('Institution update error:', error);
      toast.error(error?.message || 'Failed to update institution details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-md text-primary"><BankOutlined /></div>
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-0">My Institution</h2>
            <p className="text-xs text-slate-500 mb-0">Update the details of your institution.</p>
          </div>
        </div>
        {!loading && !loadError && (
          <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSave}>
            Save Changes
          </Button>
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
      ) : (
        <Card size="small" className="rounded-xl">
          <style>{`
            .compact-institution-form .ant-form-item { margin-bottom: 8px; }
            .compact-institution-form .ant-tabs-nav { margin-bottom: 8px !important; }
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
      )}
    </div>
  );
};

export default InstitutionDetails;
