import React from 'react';
import { Form, InputNumber, Select, Typography } from 'antd';
import {
  INTERNSHIP_TYPE,
  INTERNSHIP_TYPE_OPTIONS,
} from '../../utils/internshipCompensation';

const { Text } = Typography;

/**
 * Internship Type select plus the one amount input that belongs to it, as antd <Form.Item>s.
 *  With Stipend    -> "Stipend (₹ per month)"
 *  Paid by Student -> "Fee paid to company (₹)"
 *  Without Stipend -> no amount
 * Render it inside any <Form>; `compact` tightens the spacing for the small edit forms.
 * Wrap the items in your own grid/Col: it returns a fragment of Form.Items.
 */
const InternshipCompensationFields = ({ form, required = true, compact = false, renderItem }) => {
  const type = Form.useWatch('internshipType', form);
  const wrap = renderItem || ((node) => node);
  const itemClass = compact ? 'mb-2' : undefined;
  const inputClass = compact ? 'w-full' : 'w-full rounded-lg h-11 bg-background border-border flex items-center';

  return (
    <>
      {wrap(
        <Form.Item
          key="type"
          label="Internship Type"
          name="internshipType"
          className={itemClass}
          rules={[{ required, message: 'Please select the internship type' }]}
        >
          <Select
            className={compact ? undefined : "rounded-lg h-11"}
            placeholder="Select internship type"
            options={INTERNSHIP_TYPE_OPTIONS}
            allowClear={!required}
            onChange={() => form.setFieldsValue({ stipend: undefined, studentFeeAmount: undefined })}
          />
        </Form.Item>,
      )}

      {type === INTERNSHIP_TYPE.WITH_STIPEND &&
        wrap(
          <Form.Item
            key="stipend"
            label="Stipend (₹ per month)"
            name="stipend"
            className={itemClass}
            rules={[
              { required: true, message: 'Please enter the stipend amount' },
              { type: 'number', min: 1, message: 'Amount must be more than 0' },
            ]}
          >
            <InputNumber className={inputClass} placeholder="e.g., 8000" min={1} max={9999999} precision={0} />
          </Form.Item>,
        )}

      {type === INTERNSHIP_TYPE.PAID_BY_STUDENT &&
        wrap(
          <Form.Item
            key="fee"
            label="Fee paid to company (₹)"
            name="studentFeeAmount"
            className={itemClass}
            rules={[
              { required: true, message: 'Please enter the fee you pay to the company' },
              { type: 'number', min: 1, message: 'Amount must be more than 0' },
            ]}
            extra={<Text className="text-[10px] text-text-tertiary">Amount the student pays to the company for this internship</Text>}
          >
            <InputNumber className={inputClass} placeholder="e.g., 5000" min={1} max={9999999} precision={0} />
          </Form.Item>,
        )}
    </>
  );
};

export default InternshipCompensationFields;
