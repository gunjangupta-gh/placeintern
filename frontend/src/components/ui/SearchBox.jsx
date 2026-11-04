import React from 'react';
import { Input } from 'antd';

/** The standard list search input. Controlled: value / onChange(string). */
const SearchBox = ({ value, onChange, placeholder = 'Search', width = 300, onSearch, style, ...rest }) => (
  <Input.Search
    allowClear
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange?.(e.target.value)}
    onSearch={onSearch}
    style={{ width, ...style }}
    {...rest}
  />
);

export default SearchBox;
