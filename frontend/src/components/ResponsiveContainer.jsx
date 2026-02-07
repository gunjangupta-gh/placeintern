import React from 'react';

const ResponsiveContainer = ({ children, className = '', ...props }) => {
  return (
    <div className={`w-full max-w-7xl mx-auto px-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

export default ResponsiveContainer;