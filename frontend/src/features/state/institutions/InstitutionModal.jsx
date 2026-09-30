import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal, Form, Button, Spin } from 'antd';
import { toast } from 'react-hot-toast';
import {
  SaveOutlined,
  BankOutlined,
  EditOutlined,
  PlusOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import stateService from '../../../services/state.service';
import lookupService from '../../../services/lookup.service';
import {
  createInstitution,
  updateInstitution,
  selectInstitutions,
} from '../store/stateSlice';
import InstitutionFormTabs from '../../shared/institution/InstitutionFormTabs';
import {
  buildDefaultBranchIntakeRows,
  buildDefaultCoveredAreaRows,
  buildDefaultStaffCapacityRows,
  buildInstitutionFormValues,
  normalizeLookupList,
  sanitizeBranchIntakeRows,
  sanitizeInstitutionPayload,
  sanitizeStaffCapacityRows,
} from '../../shared/institution/institutionFormUtils';

const InstitutionModal = ({ open, onClose, institutionId, onSuccess }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const institutions = useSelector(selectInstitutions);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branchOptions, setBranchOptions] = useState([]);
  const [batchOptions, setBatchOptions] = useState([]);
  const [createPrincipal, setCreatePrincipal] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('basic');

  const isEditMode = !!institutionId;

  useEffect(() => {
    let alive = true;

    const loadInstitutionForEdit = async () => {
      setLoading(true);
      try {
        const [institutionResponse, intakesResponse, staffCapacitiesResponse] = await Promise.all([
          stateService.getInstitutionById(institutionId),
          stateService.getInstitutionBranchIntakes(institutionId),
          stateService.getInstitutionBranchStaffCapacities(institutionId),
        ]);

        const detailedInstitution = institutionResponse?.data || institutionResponse;

        if (alive && detailedInstitution) {
          const fetchedIntakes = Array.isArray(intakesResponse)
            ? intakesResponse
            : intakesResponse?.data || detailedInstitution.branchIntakes || [];
          const fetchedStaffCapacities = Array.isArray(staffCapacitiesResponse)
            ? staffCapacitiesResponse
            : staffCapacitiesResponse?.data || detailedInstitution.staffCapacities || [];
          const institutionWithIntakes = {
            ...detailedInstitution,
            branchIntakes: fetchedIntakes,
            staffCapacities: fetchedStaffCapacities,
          };
          form.setFieldsValue(buildInstitutionFormValues(institutionWithIntakes));
        }
      } catch (error) {
        // Fallback to store item if detail API fails.
        const fallbackInstitution = institutions.find((i) => i.id === institutionId);
        if (alive && fallbackInstitution) {
          form.setFieldsValue(buildInstitutionFormValues(fallbackInstitution));
        }
        if (alive) {
          setBranchOptions([]);
          setBatchOptions([]);
        }
      } finally {
        if (alive) {
          setLoading(false);
          setCreatePrincipal(false);
        }
      }
    };

    if (open) {
      const loadOptions = async () => {
        try {
          const [branchesResponse, batchesResponse] = await Promise.all([
            lookupService.getBranches(),
            lookupService.getBatches(),
          ]);

          if (!alive) return;

          const branches = normalizeLookupList(branchesResponse, 'branches');
          const batches = normalizeLookupList(batchesResponse, 'batches');

          setBranchOptions(branches.map((branch) => ({
            label: `${branch.name} (${branch.code})`,
            value: branch.id,
          })));
          setBatchOptions(batches.map((batch) => ({
            label: batch.name,
            value: batch.id,
          })));
        } catch (error) {
          if (alive) {
            setBranchOptions([]);
            setBatchOptions([]);
          }
        }
      };

      loadOptions();

      if (isEditMode) {
        loadInstitutionForEdit();
      } else {
        form.resetFields();
        form.setFieldsValue({
          country: "India",
          state: "Punjab", // Default or dynamic
          isActive: "true",
          type: "GOVT_POLYTECHNIC",
          coveredAreaDetails: buildDefaultCoveredAreaRows(),
          branchIntakes: buildDefaultBranchIntakeRows(),
          staffCapacities: buildDefaultStaffCapacityRows(),
        });
        setCreatePrincipal(false);
      }
      setActiveFormTab('basic');
    }

    return () => {
      alive = false;
    };
  }, [open, institutionId, institutions, isEditMode, form]);

  const handleClose = () => {
    form.resetFields();
    setCreatePrincipal(false);
    setActiveFormTab('basic');
    onClose();
  };

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      // Normalize optional empty fields and ensure numeric fields are numbers.
      const payload = sanitizeInstitutionPayload(values);
      const intakePayload = sanitizeBranchIntakeRows(values.branchIntakes || []);
      const staffCapacityPayload = sanitizeStaffCapacityRows(values.staffCapacities || []);

      if (isEditMode) {
        const updatedInstitution = await dispatch(updateInstitution({ id: institutionId, data: payload })).unwrap();
        const savedInstitutionId = updatedInstitution?.institution?.id || updatedInstitution?.id || institutionId;
        await stateService.replaceInstitutionBranchIntakes(savedInstitutionId, intakePayload);
        await stateService.replaceInstitutionBranchStaffCapacities(savedInstitutionId, staffCapacityPayload);
        toast.success('Institution updated successfully');
      } else {
        const createdInstitution = await dispatch(createInstitution(payload)).unwrap();
        const savedInstitutionId = createdInstitution?.institution?.id || createdInstitution?.id;
        if (savedInstitutionId) {
          await stateService.replaceInstitutionBranchIntakes(savedInstitutionId, intakePayload);
          await stateService.replaceInstitutionBranchStaffCapacities(savedInstitutionId, staffCapacityPayload);
        }
        toast.success('Institution created successfully');
      }

      handleClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.message || 'Failed to save institution');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={820}
      destroyOnHidden
      centered
      closable={false}
      className="rounded-2xl overflow-hidden"
      styles={{
        content: { borderRadius: '12px', padding: 0, overflow: 'hidden' },
        body: {
          padding: 0,
        },
        mask: { backdropFilter: 'blur(4px)' }
      }}
    >
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div className="bg-white px-4 py-2.5 border-b border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-primary/10 p-1.5 rounded-md text-primary shrink-0">
                  {isEditMode ? <EditOutlined /> : <BankOutlined />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 mb-0 truncate">
                    {isEditMode ? 'Edit Institution' : 'Add New Institution'}
                  </h3>
                </div>
              </div>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleClose}
                className="hover:bg-slate-100"
              />
            </div>
          </div>

          <div className="px-3 py-2 max-h-[calc(100vh-170px)] overflow-y-auto overflow-x-hidden">
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
              onFinish={onFinish}
              noValidate
              requiredMark={false}
              size="small"
              className="institution-form compact-institution-form"
              style={{ margin: 0 }}
            >
              <InstitutionFormTabs
                mode="state"
                isEditMode={isEditMode}
                activeFormTab={activeFormTab}
                onTabChange={setActiveFormTab}
                branchOptions={branchOptions}
                batchOptions={batchOptions}
                createPrincipal={createPrincipal}
                onCreatePrincipalChange={setCreatePrincipal}
              />

              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/60 bg-background-primary">
                <Button
                  onClick={handleClose}
                  className="h-8 px-3 rounded-lg font-medium hover:bg-surface-hover"
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  icon={isEditMode ? <SaveOutlined /> : <PlusOutlined />}
                  className="h-8 px-3 rounded-lg font-bold shadow-lg shadow-primary/20"
                >
                  {isEditMode ? 'Update Institution' : 'Create Institution'}
                </Button>
              </div>
            </Form>
          </div>
        </>
      )}
    </Modal>
  );
};

export default InstitutionModal;
