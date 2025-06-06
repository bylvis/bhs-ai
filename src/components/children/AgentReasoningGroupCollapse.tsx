import React from 'react';
import { Collapse } from 'antd';
import ReasoningStepCard from './ReasoningStepCard';

interface AgentReasoningGroupCollapseProps {
  groupType: string;
  steps: any[];
}

const AgentReasoningGroupCollapse: React.FC<AgentReasoningGroupCollapseProps> = ({ groupType, steps }) => (
  <Collapse
    size="small"
    bordered={false}
    style={{ background: 'transparent', marginBottom: 4 }}
  >
    <Collapse.Panel
      header={<span style={{ color: '#888', fontStyle: 'italic', fontWeight: 500 }}>{groupType.includes('tool') ? '调用mcp服务' : groupType}</span>}
      key="1"
    >
      <div>
        {steps.map((step, idx) => (
          <ReasoningStepCard key={step.id || idx} step={step} idx={idx} />
        ))}
      </div>
    </Collapse.Panel>
  </Collapse>
);

export default AgentReasoningGroupCollapse; 