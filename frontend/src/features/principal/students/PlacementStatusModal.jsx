import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Spin, Switch, Divider, Typography, theme } from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { AppModal } from '../../../components/ui';
import { updateStudent } from '../store/principalSlice';
import principalService from '../../../services/principal.service';
import PlacementInterestForm from '../../student/dashboard/components/PlacementInterestForm';

const { Text } = Typography;

/**
 * Principal-side placement management for one student:
 *  - placed / not placed (company, package)
 *  - placement interest (the same 3-plan form the student fills on their dashboard)
 *
 * Props: open, student ({ id, isPlaced, placedCompany, placedPackage, name }), onClose, onSaved({ isPlaced, placedCompany, placedPackage })
 */
const PlacementStatusModal = ({ open, student, onClose, onSaved }) => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const [interestForm] = Form.useForm();
  const [placement, setPlacement] = useState({ isPlaced: false, placedCompany: '', placedPackage: null });
  const [interestData, setInterestData] = useState(null);
  const [interestLoading, setInterestLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load the saved values each time the modal opens for a student
  useEffect(() => {
    if (!open || !student) return;
    setPlacement({
      isPlaced: student.isPlaced ?? false,
      placedCompany: student.placedCompany || '',
      placedPackage: student.placedPackage ?? null,
    });
    interestForm.resetFields();
    setInterestData(null);

    let cancelled = false;
    setInterestLoading(true);
    principalService
      .getStudentPlacementInterest(student.id)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? null;
        setInterestData(data);
        if (data) {
          interestForm.setFieldsValue({
            planAfterDiploma: data.planAfterDiploma,
            interestedForPrivateJob: data.interestedForPrivateJob || undefined,
            expectedSalary: data.expectedSalary || undefined,
          });
        }
      })
      .catch(() => !cancelled && toast.error('Could not load placement interest'))
      .finally(() => !cancelled && setInterestLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!student) return;
    if (placement.isPlaced && !placement.placedCompany?.trim()) {
      toast.error('Company name is required when marking a student as placed');
      return;
    }

    // Placement interest is optional: only validated and saved when a plan is chosen
    const planChosen = !!interestForm.getFieldValue('planAfterDiploma');
    let interestValues = null;
    if (planChosen) {
      try {
        interestValues = await interestForm.validateFields();
      } catch {
        return; // the form shows which field is missing
      }
    }

    setSubmitting(true);
    try {
      await dispatch(
        updateStudent({
          id: student.id,
          data: {
            isPlaced: placement.isPlaced,
            placedCompany: placement.isPlaced ? placement.placedCompany.trim() : undefined,
            placedPackage: placement.isPlaced ? placement.placedPackage : undefined,
          },
        })
      ).unwrap();

      if (interestValues) {
        await principalService.setStudentPlacementInterest(student.id, {
          planAfterDiploma: interestValues.planAfterDiploma,
          interestedForPrivateJob: interestValues.interestedForPrivateJob,
          expectedSalary: interestValues.expectedSalary,
        });
      }

      toast.success('Placement details saved');
      onSaved?.({
        isPlaced: placement.isPlaced,
        placedCompany: placement.isPlaced ? placement.placedCompany.trim() : null,
        placedPackage: placement.isPlaced ? placement.placedPackage : null,
      });
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || error || 'Failed to save placement details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      title="Placement Details"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save"
      okButtonProps={{ loading: submitting }}
      cancelButtonProps={{ disabled: submitting }}
      destroyOnClose
    >
      <p>
        Placement details for <strong>{student?.name}</strong>
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Switch checked={placement.isPlaced} onChange={(checked) => setPlacement((p) => ({ ...p, isPlaced: checked }))} />
        <span>{placement.isPlaced ? 'Placed' : 'Not Placed'}</span>
      </div>

      {placement.isPlaced && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 13, color: token.colorTextSecondary }}>Company</div>
            <Input
              placeholder="Company name"
              value={placement.placedCompany}
              onChange={(e) => setPlacement((p) => ({ ...p, placedCompany: e.target.value }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 13, color: token.colorTextSecondary }}>Package (LPA)</div>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.1}
              placeholder="e.g. 3.5"
              value={placement.placedPackage}
              onChange={(value) => setPlacement((p) => ({ ...p, placedPackage: value }))}
            />
          </div>
        </>
      )}

      <Divider style={{ margin: '16px 0' }} />
      <div style={{ marginBottom: 8 }}>
        <Text strong>Placement Interest</Text>
        <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {interestData ? 'Filled by the student or principal. You can change it here.' : 'Not filled yet. Optional - select a plan to fill it for the student.'}
        </div>
      </div>
      <Spin spinning={interestLoading}>
        <PlacementInterestForm form={interestForm} initialData={null} />
      </Spin>
    </AppModal>
  );
};

export default PlacementStatusModal;
