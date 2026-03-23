import React, { useState, useEffect } from 'react';
import { Form, Radio, Space, Typography, theme } from 'antd';
import {
  BankOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  EnvironmentOutlined,
  DollarOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const PLAN_AFTER_DIPLOMA = {
  PRIVATE_JOB: 'PRIVATE_JOB',
  BTECH: 'BTECH',
  GOVT_JOB_PREPARATION: 'GOVT_JOB_PREPARATION',
};

const JOB_LOCATION_PREFERENCE = {
  WITHIN_PUNJAB: 'WITHIN_PUNJAB',
  OUTSIDE_PUNJAB: 'OUTSIDE_PUNJAB',
};

const EXPECTED_SALARY_RANGE = {
  RANGE_10K_15K: 'RANGE_10K_15K',
  RANGE_15K_20K: 'RANGE_15K_20K',
  RANGE_20K_PLUS: 'RANGE_20K_PLUS',
};

const PlacementInterestForm = ({ form, initialData = null, onValuesChange }) => {
  const { token } = theme.useToken();
  const [selectedPlan, setSelectedPlan] = useState(initialData?.planAfterDiploma || null);

  useEffect(() => {
    if (initialData) {
      form.setFieldsValue(initialData);
      setSelectedPlan(initialData.planAfterDiploma);
    }
  }, [initialData, form]);

  const handlePlanChange = (e) => {
    setSelectedPlan(e.target.value);
    if (e.target.value !== PLAN_AFTER_DIPLOMA.PRIVATE_JOB) {
      form.setFieldsValue({ interestedForPrivateJob: undefined, expectedSalary: undefined });
    }
    onValuesChange?.();
  };

  const showJobFields = selectedPlan === PLAN_AFTER_DIPLOMA.PRIVATE_JOB;

  const OptionCard = ({ value, icon, label, selected, color }) => (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all"
      style={{
        borderColor: selected ? token.colorPrimary : token.colorBorder,
        backgroundColor: selected ? token.colorPrimaryBg : 'transparent',
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-base"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <Text strong={selected}>{label}</Text>
    </div>
  );

  return (
    <Form form={form} layout="vertical" initialValues={initialData || {}} onValuesChange={onValuesChange}>
      <Form.Item
        name="planAfterDiploma"
        label={<Text strong>Plan after completing diploma</Text>}
        rules={[{ required: true, message: 'Please select your plan' }]}
      >
        <Radio.Group onChange={handlePlanChange} className="w-full">
          <Space direction="vertical" className="w-full" size={8}>
            <Radio value={PLAN_AFTER_DIPLOMA.PRIVATE_JOB} className="w-full !m-0">
              <OptionCard
                icon={<BankOutlined />}
                label="Private Job"
                selected={selectedPlan === PLAN_AFTER_DIPLOMA.PRIVATE_JOB}
                color={token.colorPrimary}
              />
            </Radio>
            <Radio value={PLAN_AFTER_DIPLOMA.BTECH} className="w-full !m-0">
              <OptionCard
                icon={<BookOutlined />}
                label="B.Tech (Higher Education)"
                selected={selectedPlan === PLAN_AFTER_DIPLOMA.BTECH}
                color={token.colorSuccess}
              />
            </Radio>
            <Radio value={PLAN_AFTER_DIPLOMA.GOVT_JOB_PREPARATION} className="w-full !m-0">
              <OptionCard
                icon={<SafetyCertificateOutlined />}
                label="Government Job Preparation"
                selected={selectedPlan === PLAN_AFTER_DIPLOMA.GOVT_JOB_PREPARATION}
                color={token.colorWarning}
              />
            </Radio>
          </Space>
        </Radio.Group>
      </Form.Item>

      {showJobFields && (
        <>
          <Form.Item
            name="interestedForPrivateJob"
            label={<Text strong>Preferred job location</Text>}
            rules={[{ required: true, message: 'Please select location preference' }]}
          >
            <Radio.Group className="w-full">
              <Space direction="vertical" className="w-full" size={8}>
                <Radio value={JOB_LOCATION_PREFERENCE.WITHIN_PUNJAB} className="w-full !m-0">
                  <OptionCard
                    icon={<EnvironmentOutlined />}
                    label="Within Punjab"
                    selected={form.getFieldValue('interestedForPrivateJob') === JOB_LOCATION_PREFERENCE.WITHIN_PUNJAB}
                    color={token.colorInfo}
                  />
                </Radio>
                <Radio value={JOB_LOCATION_PREFERENCE.OUTSIDE_PUNJAB} className="w-full !m-0">
                  <OptionCard
                    icon={<EnvironmentOutlined />}
                    label="Outside Punjab"
                    selected={form.getFieldValue('interestedForPrivateJob') === JOB_LOCATION_PREFERENCE.OUTSIDE_PUNJAB}
                    color={token.colorInfo}
                  />
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="expectedSalary"
            label={<Text strong>Expected monthly salary</Text>}
            rules={[{ required: true, message: 'Please select expected salary' }]}
            className="!mb-0"
          >
            <Radio.Group className="w-full">
              <Space direction="vertical" className="w-full" size={8}>
                <Radio value={EXPECTED_SALARY_RANGE.RANGE_10K_15K} className="w-full !m-0">
                  <OptionCard
                    icon={<DollarOutlined />}
                    label="₹10,000 - ₹15,000"
                    selected={form.getFieldValue('expectedSalary') === EXPECTED_SALARY_RANGE.RANGE_10K_15K}
                    color={token.colorSuccess}
                  />
                </Radio>
                <Radio value={EXPECTED_SALARY_RANGE.RANGE_15K_20K} className="w-full !m-0">
                  <OptionCard
                    icon={<DollarOutlined />}
                    label="₹15,000 - ₹20,000"
                    selected={form.getFieldValue('expectedSalary') === EXPECTED_SALARY_RANGE.RANGE_15K_20K}
                    color={token.colorSuccess}
                  />
                </Radio>
                <Radio value={EXPECTED_SALARY_RANGE.RANGE_20K_PLUS} className="w-full !m-0">
                  <OptionCard
                    icon={<DollarOutlined />}
                    label="₹20,000+"
                    selected={form.getFieldValue('expectedSalary') === EXPECTED_SALARY_RANGE.RANGE_20K_PLUS}
                    color={token.colorSuccess}
                  />
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </>
      )}
    </Form>
  );
};

export { PLAN_AFTER_DIPLOMA, JOB_LOCATION_PREFERENCE, EXPECTED_SALARY_RANGE };
export default PlacementInterestForm;
