import React from 'react';

const GlassCard = ({ children, className = "" }) => {
  return (
    <div className={`bg-surface/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 ${className}`}>
      {children}
    </div>
  );
};

export default GlassCard;
