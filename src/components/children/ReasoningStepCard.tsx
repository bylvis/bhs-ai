import React from 'react';
import formatJson from '../utils/formatJson';

interface ReasoningStepCardProps {
  step: any;
  idx: number;
}

const ReasoningStepCard: React.FC<ReasoningStepCardProps> = ({ step, idx }) => {
  if (!step || !step.action_name || !step.action_type || (!step.arguments && !step.observation)) return null;
  return (
    <div
      style={{
        marginBottom: 16,
        background: '#f6f8fa',
        borderRadius: 8,
        padding: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        border: '1px solid #e4e8ee',
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: '#3b5998', fontSize: 15 }}>{step.action_name || step.action || '未命名操作'}</span>
        {step.action_type && <span style={{ marginLeft: 10, color: '#888', fontSize: 13, background: '#e6f7ff', borderRadius: 4, padding: '2px 8px' }}>{step.action_type}</span>}
      </div>
      {step.arguments && String(step.arguments).trim() !== '' && (
        <div style={{ marginBottom: 4 }}>
          <b style={{ color: '#555' }}>参数：</b>
          <pre style={{ background: '#fff', borderRadius: 4, padding: 8, margin: 0, fontSize: 13, color: '#222', border: '1px solid #e4e8ee' }}>
            {formatJson(step.arguments)}
          </pre>
        </div>
      )}
      {step.observation && (
        <div>
          <b style={{ color: '#555' }}>Observation：</b>
          <pre style={{ background: '#fff', borderRadius: 4, padding: 8, margin: 0, fontSize: 13, color: '#222', border: '1px solid #e4e8ee' }}>
            {formatJson(step.observation)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ReasoningStepCard; 