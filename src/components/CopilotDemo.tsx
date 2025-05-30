import React, { useState } from 'react';
import { useWorkareaStyle } from './styles/CopilotStyles';
import Copilot from './children/Copilot';
import { Image } from 'antd';

const CopilotDemo = () => {
  const { styles: workareaStyles } = useWorkareaStyle();
  const [copilotOpen, setCopilotOpen] = useState(true);

  return (
    <div className={workareaStyles.copilotWrapper}>
      {/* 左侧工作区 */}
      {/* 右侧对话区 */}
      <button onClick={() => setCopilotOpen(!copilotOpen)}>
        {copilotOpen ? '关闭' : '打开'}
      </button>
      <Copilot copilotOpen={copilotOpen} setCopilotOpen={setCopilotOpen} />
    </div>
  );
};

export default CopilotDemo; 