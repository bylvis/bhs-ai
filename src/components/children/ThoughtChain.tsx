import { ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItem, ThoughtChainProps } from '@ant-design/x';
import React, { useEffect, useRef, useState } from 'react';
import formatJson from '../utils/formatJson';
import { Card, Typography } from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

interface ObservationItem {
  title: string;
  content: string;
  webSearch?: boolean;
  webSearchUrl?: string;
  dataName?: string;
  display?: boolean;
  id?: string;
  rankWeight?: number;
  referenceIndex?: number;
  rejectStatus?: boolean;
  score?: number;
  scoreWithWeight?: number;
}

interface MockContentProps {
  observation: string; // JSON 字符串，内容为 ObservationItem[]
  action_input_stream?: string;
  arguments?: string;
  action_name?: string;
  action_type?: string;
}
const mockContent = (props: MockContentProps) => {
  const content: ObservationItem[] = JSON.parse(props.observation)
  return (
    <Typography>
        <div style={{ marginBottom: 4 }}>
          <b style={{ color: '#555' }}>参数：</b>
          <pre style={{ background: '#fff', borderRadius: 4, padding: 8, margin: 0, fontSize: 13, color: '#222', border: '1px solid #e4e8ee' }}>
            {formatJson(props.arguments)}
          </pre>
        </div>
      {Array.isArray(content) && content.map((item: ObservationItem,index:number) => (
        <Paragraph key={index}>
          {item.title && <div><strong>标题：</strong> {item.title}</div>}
          {item.content && <div><strong>内容：</strong> {item.content}</div>}
          {item.webSearch && <div><strong>链接：</strong> <a href={item.webSearch ? item.webSearchUrl : ''} target="_blank">{item.webSearch ? item.webSearchUrl : ''}</a></div>}
        </Paragraph>
      ))}
    </Typography>
  )
}
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
const App: React.FC<{content: any}> = ({content}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState('success')

  useEffect(() => {
    setStatus('pending')
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      // 定时器到期，全部变 success
      setStatus('success')
    }, 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content.length])

  const items = content.filter((item: any) => item.action_input_stream).map((item: MockContentProps,index:number) => {

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
};

export default App;