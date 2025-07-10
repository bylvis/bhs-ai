import { ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItem, ThoughtChainProps } from '@ant-design/x';
import React, { useEffect, useRef, useState } from 'react';
import formatJson from '../utils/formatJson';
import { Card, Typography } from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { MockContentProps, ObservationItem } from '../types/types';

const { Paragraph } = Typography;

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircleOutlined />;
    case 'error':
      return <InfoCircleOutlined />;
    case 'pending':
      return <LoadingOutlined />;
    default:
      return undefined;
  }
}
const App: React.FC<{content: any, isLoading: boolean}> = React.memo(({content, isLoading}) => {

  const [status, setStatus] = useState('success')

  useEffect(() => {
    if(isLoading){
      setStatus('pending');
    }else{
      setStatus('success');
    }
  }, [isLoading]);

  const items = content.map((item: MockContentProps,index:number) => {
    
    return {
      key: `step-${index + 1}`,
      title: item.action_name,
      description: item.action_type,
      content: mockContent(item),
      icon: getStatusIcon(status),
      status: status,
    }
  });
  const [expandedKeys, setExpandedKeys] = useState(['item-2']);

  const collapsible: ThoughtChainProps['collapsible'] = {
    expandedKeys,
    onExpand: (keys: string[]) => {
      setTimeout(() => setExpandedKeys(keys), 0);
    },
  };
  return (
    <Card style={{ width: '100%'}} className='thought-chain-card'>
      <ThoughtChain items={items} collapsible={collapsible} />
    </Card>
  );
});


const mockContent = (props: MockContentProps) => {
  const { observation, thought, arguments: argumentsContent } = props; 
  const observationContent: ObservationItem[] = JSON.parse(observation || '[]')
  return (
    <Typography>
      {/* 思考过程 */}
      <div>
        {thought}
      </div>
      {/* 参数 */}
       {argumentsContent !== undefined && <div style={{ marginBottom: 4 }}>
          <b style={{ color: '#555' }}>参数：</b>
          <pre style={{ background: '#fff', borderRadius: 4, padding: 8, margin: 0, fontSize: 13, color: '#222', border: '1px solid #e4e8ee' }}>
            {formatJson(argumentsContent)}
          </pre>
        </div>
        }
      {Array.isArray(observationContent) && observationContent.map((item: ObservationItem,index:number) => (
        <Paragraph key={index}>
          {typeof item === 'string' && <div>{item}</div>}
          {item.title && <div><strong>标题：</strong> {item.title}</div>}
          {item.content && <div><strong>内容：</strong> {item.content}</div>}
          {item.webSearch && <div><strong>链接：</strong> <a href={item.webSearch ? item.webSearchUrl : ''} target="_blank">{item.webSearch ? item.webSearchUrl : ''}</a></div>}
        </Paragraph>
      ))}
    </Typography>
  )
}
export default App;