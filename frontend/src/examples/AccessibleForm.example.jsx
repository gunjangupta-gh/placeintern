/**
 * Example: Accessible Form Implementation
 *
 * This example demonstrates how to create accessible forms
 * using the AccessibleForm components with proper ARIA attributes.
 */

import React from 'react';
import { Input, Select, DatePicker, Button, Radio } from 'antd';
import AccessibleFormItem, {
  AccessibleForm,
  FormSection,
  FieldGroup,
} from '../components/common/AccessibleFormItem';

const { TextArea } = Input;
const { Option } = Select;

const StudentRegistrationForm = () => {
  const [form] = AccessibleForm.useForm();

  const handleSubmit = (values) => {
    console.log('Form submitted:', values);
  };

  return (
    <AccessibleForm
      form={form}
      name="student-registration"
      ariaLabel="Student Registration Form"
      layout="vertical"
      onFinish={handleSubmit}
      className="max-w-4xl mx-auto p-6"
    >
      {/* Personal Information Section */}
      <FormSection
        title="Personal Information"
        description="Please provide your basic personal details"
        headingLevel={2}
      >
        <AccessibleFormItem
          label="Full Name"
          name="fullName"
          required
          rules={[
            { required: true, message: 'Please enter your full name' }
          ]}
          help="Enter your name as it appears on official documents"
          ariaLabel="Full legal name"
        >
          <Input placeholder="John Doe" />
        </AccessibleFormItem>

        <AccessibleFormItem
          label="Date of Birth"
          name="dateOfBirth"
          required
          rules={[
            { required: true, message: 'Please select your date of birth' }
          ]}
        >
          <DatePicker
            className="w-full"
            format="DD/MM/YYYY"
          />
        </AccessibleFormItem>

        <AccessibleFormItem
          label="Gender"
          name="gender"
          required
          rules={[
            { required: true, message: 'Please select your gender' }
          ]}
        >
          <Radio.Group>
            <Radio value="male">Male</Radio>
            <Radio value="female">Female</Radio>
            <Radio value="other">Other</Radio>
            <Radio value="prefer-not-to-say">Prefer not to say</Radio>
          </Radio.Group>
        </AccessibleFormItem>
      </FormSection>

      {/* Contact Information Section */}
      <FormSection
        title="Contact Information"
        description="We'll use this information to communicate with you"
        headingLevel={2}
      >
        <FieldGroup
          legend="Primary Contact"
          description="Your main contact details"
          required
        >
          <AccessibleFormItem
            label="Email Address"
            name="email"
            required
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
            help="We'll send important updates to this email"
          >
            <Input type="email" placeholder="john.doe@example.com" />
          </AccessibleFormItem>

          <AccessibleFormItem
            label="Phone Number"
            name="phone"
            required
            rules={[
              { required: true, message: 'Please enter your phone number' },
              { pattern: /^[0-9]{10}$/, message: 'Please enter a valid 10-digit phone number' }
            ]}
          >
            <Input type="tel" placeholder="1234567890" />
          </AccessibleFormItem>
        </FieldGroup>

        <FieldGroup
          legend="Address"
          description="Your current residential address"
        >
          <AccessibleFormItem
            label="Street Address"
            name="address"
            required
            rules={[
              { required: true, message: 'Please enter your address' }
            ]}
          >
            <TextArea rows={3} placeholder="123 Main Street, Apartment 4B" />
          </AccessibleFormItem>

          <div className="grid grid-cols-2 gap-4">
            <AccessibleFormItem
              label="City"
              name="city"
              required
              rules={[
                { required: true, message: 'Please enter your city' }
              ]}
            >
              <Input placeholder="New York" />
            </AccessibleFormItem>

            <AccessibleFormItem
              label="Postal Code"
              name="postalCode"
              required
              rules={[
                { required: true, message: 'Please enter postal code' },
                { pattern: /^[0-9]{6}$/, message: 'Please enter a valid 6-digit postal code' }
              ]}
            >
              <Input placeholder="123456" />
            </AccessibleFormItem>
          </div>
        </FieldGroup>
      </FormSection>

      {/* Academic Information Section */}
      <FormSection
        title="Academic Information"
        description="Details about your academic background"
        headingLevel={2}
      >
        <AccessibleFormItem
          label="Department"
          name="department"
          required
          rules={[
            { required: true, message: 'Please select your department' }
          ]}
          help="Choose the department you're enrolling in"
        >
          <Select placeholder="Select department">
            <Option value="cse">Computer Science Engineering</Option>
            <Option value="ece">Electronics Engineering</Option>
            <Option value="me">Mechanical Engineering</Option>
            <Option value="civil">Civil Engineering</Option>
          </Select>
        </AccessibleFormItem>

        <AccessibleFormItem
          label="Batch"
          name="batch"
          required
          rules={[
            { required: true, message: 'Please select your batch' }
          ]}
        >
          <Select placeholder="Select batch year">
            <Option value="2024">2024</Option>
            <Option value="2025">2025</Option>
            <Option value="2026">2026</Option>
            <Option value="2027">2027</Option>
          </Select>
        </AccessibleFormItem>

        <AccessibleFormItem
          label="Previous Education"
          name="previousEducation"
          help="Describe your highest level of education completed"
        >
          <TextArea rows={4} placeholder="Bachelor of Engineering in Computer Science from XYZ University" />
        </AccessibleFormItem>
      </FormSection>

      {/* Form Actions */}
      <div className="flex gap-4 justify-end mt-6">
        <Button
          onClick={() => form.resetFields()}
          aria-label="Clear form and start over"
        >
          Reset
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          aria-label="Submit student registration form"
        >
          Submit Registration
        </Button>
      </div>
    </AccessibleForm>
  );
};

export default StudentRegistrationForm;

/**
 * Accessibility Features Demonstrated:
 *
 * 1. Semantic Structure
 *    - FormSection with proper headings (h2, h3)
 *    - FieldGroup using fieldset/legend
 *    - Logical tab order
 *
 * 2. ARIA Attributes
 *    - aria-label for screen readers
 *    - aria-required for required fields
 *    - aria-describedby linking help text
 *    - aria-invalid for validation errors
 *
 * 3. Labels and Instructions
 *    - Visible labels for all fields
 *    - Help text for clarification
 *    - Error messages linked to fields
 *    - Section descriptions
 *
 * 4. Keyboard Navigation
 *    - Proper tab order
 *    - Enter to submit
 *    - Arrow keys in radio groups
 *
 * 5. Error Handling
 *    - Validation messages
 *    - Error focus management
 *    - Clear error descriptions
 *
 * Testing Checklist:
 * [ ] Navigate entire form using only keyboard
 * [ ] Test with screen reader (NVDA/JAWS/VoiceOver)
 * [ ] Verify all fields have labels
 * [ ] Check error announcements
 * [ ] Test with high contrast mode
 * [ ] Verify focus indicators are visible
 * [ ] Test form submission with Enter key
 * [ ] Verify required field indicators
 */
