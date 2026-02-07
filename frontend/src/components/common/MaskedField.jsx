import React, { useState, useCallback } from 'react';
import { Typography, Tooltip, Spin, message } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * MaskedField Component
 *
 * Displays masked sensitive data with an option to reveal the full value.
 * When revealed, also provides a copy to clipboard option.
 *
 * @param {string} maskedValue - The masked value to display (e.g., "******1234")
 * @param {string} fieldName - Field identifier for the reveal API (e.g., "phoneNo", "email")
 * @param {Function} onReveal - Async function to fetch unmasked value. Should return the unmasked string.
 * @param {string} className - Additional CSS classes
 * @param {object} style - Inline styles
 * @param {boolean} copyable - Whether to show copy button when revealed (default: true)
 * @param {string} placeholder - Text to show if no value (default: "N/A")
 */
const MaskedField = ({
  maskedValue,
  fieldName,
  onReveal,
  className = '',
  style = {},
  copyable = true,
  placeholder = 'N/A',
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealedValue, setRevealedValue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check if value looks masked (contains asterisks or X's)
  const isMasked = maskedValue && (
    maskedValue.includes('*') ||
    maskedValue.includes('XXXX') ||
    maskedValue.includes('****')
  );

  const handleReveal = useCallback(async () => {
    if (isRevealed) {
      // Hide the value
      setIsRevealed(false);
      setRevealedValue(null);
      return;
    }

    if (!onReveal) {
      message.warning('Reveal function not provided');
      return;
    }

    setLoading(true);
    try {
      const value = await onReveal(fieldName);
      if (value) {
        setRevealedValue(value);
        setIsRevealed(true);
      } else {
        message.info('No value available');
      }
    } catch (error) {
      message.error(error.message || 'Failed to reveal value');
    } finally {
      setLoading(false);
    }
  }, [isRevealed, onReveal, fieldName]);

  const handleCopy = useCallback(async () => {
    const valueToCopy = revealedValue || maskedValue;
    if (!valueToCopy || valueToCopy === placeholder) return;

    try {
      await navigator.clipboard.writeText(valueToCopy);
      setCopied(true);
      message.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      message.error('Failed to copy');
    }
  }, [revealedValue, maskedValue, placeholder]);

  // If no value, show placeholder
  if (!maskedValue) {
    return <Text type="secondary">{placeholder}</Text>;
  }

  // If not masked, just show the value
  if (!isMasked) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`} style={style}>
        <Text>{maskedValue}</Text>
        {copyable && (
          <Tooltip title={copied ? 'Copied!' : 'Copy'}>
            <button
              onClick={handleCopy}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors cursor-pointer border-0 bg-transparent"
            >
              {copied ? (
                <CheckOutlined style={{ fontSize: 12, color: '#52c41a' }} />
              ) : (
                <CopyOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />
              )}
            </button>
          </Tooltip>
        )}
      </span>
    );
  }

  // Display masked value with reveal option
  const displayValue = isRevealed && revealedValue ? revealedValue : maskedValue;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} style={style}>
      <Text className={isRevealed ? 'text-green-600' : ''}>
        {displayValue}
      </Text>

      {loading ? (
        <Spin size="small" />
      ) : (
        <Tooltip title={isRevealed ? 'Hide' : 'Click to reveal'}>
          <button
            onClick={handleReveal}
            className="p-0.5 hover:bg-gray-100 rounded transition-colors cursor-pointer border-0 bg-transparent"
          >
            {isRevealed ? (
              <EyeInvisibleOutlined style={{ fontSize: 14, color: '#52c41a' }} />
            ) : (
              <EyeOutlined style={{ fontSize: 14, color: '#1890ff' }} />
            )}
          </button>
        </Tooltip>
      )}

      {isRevealed && copyable && revealedValue && (
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <button
            onClick={handleCopy}
            className="p-0.5 hover:bg-gray-100 rounded transition-colors cursor-pointer border-0 bg-transparent"
          >
            {copied ? (
              <CheckOutlined style={{ fontSize: 12, color: '#52c41a' }} />
            ) : (
              <CopyOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />
            )}
          </button>
        </Tooltip>
      )}
    </span>
  );
};

export default MaskedField;
