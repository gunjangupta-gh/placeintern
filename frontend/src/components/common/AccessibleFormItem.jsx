import React from 'react';
import { Form } from 'antd';

/**
 * Enhanced Form.Item with built-in accessibility attributes
 * Automatically adds aria-labels, aria-required, and other a11y attributes
 */
const AccessibleFormItem = ({
  children,
  label,
  name,
  required,
  tooltip,
  help,
  extra,
  ariaLabel,
  ariaDescribedBy,
  role,
  ...restProps
}) => {
  // Generate unique IDs for accessibility
  const fieldId = name ? `field-${Array.isArray(name) ? name.join('-') : name}` : undefined;
  const helpId = help ? `${fieldId}-help` : undefined;
  const errorId = `${fieldId}-error`;

  // Enhance children with accessibility props
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    // Add accessibility attributes to form controls
    const accessibilityProps = {
      id: fieldId,
      'aria-label': ariaLabel || (typeof label === 'string' ? label : undefined),
      'aria-required': required || undefined,
      'aria-describedby': [
        ariaDescribedBy,
        helpId,
        errorId,
      ].filter(Boolean).join(' ') || undefined,
      'aria-invalid': undefined, // Will be set by Form validation
      role: role || child.props.role,
    };

    return React.cloneElement(child, {
      ...accessibilityProps,
      ...child.props,
    });
  });

  return (
    <Form.Item
      label={label}
      name={name}
      required={required}
      tooltip={tooltip}
      help={help ? <span id={helpId}>{help}</span> : undefined}
      extra={extra}
      {...restProps}
    >
      {enhancedChildren}
    </Form.Item>
  );
};

/**
 * Accessible Form wrapper that sets proper ARIA attributes
 */
export const AccessibleForm = ({
  children,
  name,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  ...restProps
}) => {
  return (
    <Form
      name={name}
      aria-label={ariaLabel || name}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      role="form"
      {...restProps}
    >
      {children}
    </Form>
  );
};

/**
 * Accessible form section with proper heading structure
 */
export const FormSection = ({
  title,
  description,
  children,
  headingLevel = 2,
  id,
}) => {
  const HeadingTag = `h${headingLevel}`;
  const sectionId = id || `section-${title?.toLowerCase().replace(/\s+/g, '-')}`;
  const descId = description ? `${sectionId}-desc` : undefined;

  return (
    <section
      aria-labelledby={sectionId}
      aria-describedby={descId}
      className="form-section"
    >
      {title && (
        <HeadingTag id={sectionId} className="form-section-title">
          {title}
        </HeadingTag>
      )}
      {description && (
        <p id={descId} className="form-section-description">
          {description}
        </p>
      )}
      <div className="form-section-content">{children}</div>
    </section>
  );
};

/**
 * Accessible field group for related form fields
 */
export const FieldGroup = ({
  legend,
  description,
  children,
  required,
}) => {
  const groupId = `group-${legend?.toLowerCase().replace(/\s+/g, '-')}`;
  const descId = description ? `${groupId}-desc` : undefined;

  return (
    <fieldset
      aria-describedby={descId}
      aria-required={required}
      className="field-group"
    >
      {legend && <legend className="field-group-legend">{legend}</legend>}
      {description && (
        <p id={descId} className="field-group-description">
          {description}
        </p>
      )}
      {children}
    </fieldset>
  );
};

export default AccessibleFormItem;
