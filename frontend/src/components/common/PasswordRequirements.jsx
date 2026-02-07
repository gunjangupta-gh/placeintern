import React from 'react';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

/**
 * Password Requirements Component
 * Displays password policy requirements with real-time validation
 */
const PasswordRequirements = ({ password = '', showTitle = true }) => {
  const requirements = [
    {
      key: 'length',
      label: 'At least 12 characters',
      test: (pwd) => pwd.length >= 12,
    },
    {
      key: 'uppercase',
      label: 'One uppercase letter (A-Z)',
      test: (pwd) => /[A-Z]/.test(pwd),
    },
    {
      key: 'lowercase',
      label: 'One lowercase letter (a-z)',
      test: (pwd) => /[a-z]/.test(pwd),
    },
    {
      key: 'number',
      label: 'One number (0-9)',
      test: (pwd) => /[0-9]/.test(pwd),
    },
    {
      key: 'special',
      label: 'One special character (!@#$%^&*)',
      test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    },
  ];

  const getRequirementStatus = (requirement) => {
    if (!password) return 'pending';
    return requirement.test(password) ? 'passed' : 'failed';
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
      {showTitle && (
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Password Requirements:
        </p>
      )}
      <ul className="space-y-1">
        {requirements.map((req) => {
          const status = getRequirementStatus(req);
          return (
            <li
              key={req.key}
              className={`flex items-center gap-2 text-xs transition-colors ${
                status === 'passed'
                  ? 'text-green-600 dark:text-green-400'
                  : status === 'failed'
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {status === 'passed' ? (
                <CheckCircleOutlined className="text-green-500" />
              ) : status === 'failed' ? (
                <CloseCircleOutlined className="text-red-500" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600" />
              )}
              {req.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * Validate password against all requirements
 * @param {string} password - The password to validate
 * @returns {object} - { isValid: boolean, errors: string[] }
 */
export const validatePassword = (password) => {
  const errors = [];

  if (!password || password.length < 12) {
    errors.push('Password must be at least 12 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export default PasswordRequirements;
