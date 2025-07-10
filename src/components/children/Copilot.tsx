import React, { useEffect, useState, useRef } from 'react';
import {
  Bubble,
  Sender,
  Suggestion
} from '@ant-design/x';
import {
  CloseOutlined,
  CommentOutlined,
  CopyOutlined,
  PlusOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { Button, Popover, Space, Spin, message, Collapse } from 'antd';
import { useCopilotStyle } from '../styles/CopilotStyles';
import type { CopilotProps } from '../types/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../styles/Copilot.css';
import ThoughtChain from './ThoughtChain';
import { useCopilotSession } from '../hooks/useCopilotSession';

// 动态获取 API base url
function getApiBaseUrl() {
  // Vite 环境变量优先，类型兼容
  const viteUrl = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE_URL;
  if (viteUrl && viteUrl !== '/') {
    return viteUrl;
  }
  return 'http://localhost:3001';
}

// 修改 fetchAIStream 支持 abort，支持自定义 url
async function fetchAIStreamWithAbort(body: any, onData: (data: string) => void, controller: AbortController, url: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let lines = buffer.split('\n\n');
    buffer = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.replace('data: ', '');
        onData(data);
      }
    }
  }
}

const Copilot = (props: CopilotProps) => {
  // 开关
  const { copilotOpen, setCopilotOpen } = props;
  // 样式
  const { styles } = useCopilotStyle();
  // 控制器 打断对话
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  // 全局消息
  const [msgApi, contextHolder] = message.useMessage();

  // 输入框
  const [inputValue, setInputValue] = useState('');
  // 加载中
  const [loading, setLoading] = useState(false);
  // 当前会话
  const [curSession, setCurSession] = useState<string>('');
  // 聊天列表
  const [chatList, setChatList] = useState(JSON.parse(localStorage.getItem(`copilot_message_${curSession}`) || '[]'))
  
  const { handleNewSession, deleteSession } = useCopilotSession();

  const [sessionList, setSessionList] = useState(JSON.parse(localStorage.getItem('copilot_session_list') || '[]'));
  useEffect(() => {
    if(sessionList.length > 0) {
      setCurSession(sessionList[0].key);
    }else {
      handleNewSessionFn();
    }
  }, []);
  // 在组件中添加 ref
  const chatListRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    if (chatListRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatListRef.current;
      // 检查是否在最底部
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 允许一定的误差
      if (isAtBottom) {
        setTimeout(() => {
          if (chatListRef.current) { // 添加 null 检查
            chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
          }
        }, 100);
      }
    }
  }

  // 会话切换 滚动到聊天列表底部
  useEffect(() => {
    setChatList(JSON.parse(localStorage.getItem(`copilot_message_${curSession}`) || '[]'));
    handleScroll();
  }, [curSession]);

  useEffect(() => {
    handleScroll();
  }, []);

  // 支持自定义 url 的 handleUserSubmit
  const handleUserSubmit = async (val: string) => {
    if (loading) return; // 防止重复请求
    const sessionList = JSON.parse(localStorage.getItem('copilot_session_list') || '[]');
    const session = sessionList.find(item => item.key === curSession);
    if(session){
      session.label = val;
    }
    localStorage.setItem('copilot_session_list',JSON.stringify(sessionList));
    setSessionList(sessionList);
    setLoading(true);
    const controller = new AbortController();
    setAbortController(controller);
    let url = getApiBaseUrl() + '/ai/dashscope-proxy-stream';
    let fetchBody = {
      prompt: val,
      has_thoughts: true,
      session_id:chatList[chatList.length - 1]?.response?.output?.session_id,
      // 其他参数可扩展
    };
    try {
      // 立即更新聊天列表
      setChatList(prev => {
        const updatedList = [...prev, { send: val, type: 'temp' }];
        return updatedList;
      });
      handleScroll();
      await fetchAIStreamWithAbort(
        fetchBody,
        (data) => {
          const parsed = JSON.parse(data);
          setChatList(prev => prev.map(item => item.type === 'temp' ? { ...item, response: parsed } : item));
          setChatList([
            ...chatList,
            {
              send:val,
              response:parsed
            }
          ]);
          if(parsed.output.finish_reason === 'stop'){
            localStorage.setItem(`copilot_message_${curSession}`,JSON.stringify([...chatList, { send: val, response: parsed }]));
          }
          // 在更新后检查是否在最底部
          handleScroll();
        },
        controller,
        url
      );
    } catch (e) {

    }
    setAbortController(null);
    setLoading(false);
  };

  // 会话切换
  const handleSessionChange = (key: string) => {
    // 切换到选定的会话
    const selectedSession = sessionList.find(session => session.key === key);
    if (selectedSession) {
      // 更新当前会话状态
      setCurSession(selectedSession.key);
    }
  };
  // 会话删除 自动选取第一个
  const handlerDeleteSession = (key: string) => {
    deleteSession(key);
    localStorage.removeItem(`copilot_message_${key}`);
    
    // 过滤掉被删除的会话
    const updatedSessionList = sessionList.filter(item => item.key !== key);
    setSessionList(updatedSessionList);
    
    // 检查更新后的 sessionList 是否为空
    if (updatedSessionList.length > 0) {
        setCurSession(updatedSessionList[0].key); // 设置为新的第一个会话
    } else {
        setCurSession(''); // 或者设置为 null，表示没有当前会话
    }
}
  // 会话新增
  const handleNewSessionFn = () => {
    if(loading) return;
    const newKey = new Date().getTime().toString();
    handleNewSession(newKey);
    setSessionList(sessionList.concat({key: newKey, label: newKey}));
    setCurSession(newKey);
    localStorage.setItem(`copilot_message_${newKey}`,JSON.stringify([]));
    setChatList([]);
  }
  // 顶部气泡
  const sessionPopover = (
    <Popover
      placement="bottom"
      content={
        <div style={{ minWidth: 200 }}>
          {sessionList.map((item) => (
            <div
              key={item.key}
              onClick={() => handleSessionChange(item.key)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: item.key === curSession ? '#f0f0f0' : undefined,
                borderRadius: 4,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{item.label}</span>
              { sessionList.length > 1 && 
              <CloseOutlined
                style={{ marginLeft: 8, color: '#bbb', fontSize: 14, cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation();
                  handlerDeleteSession(item.key);
                }}
              />
              }
            </div>
          ))}
        </div>
      }
      trigger="click"
    >
      <Button disabled={loading} type="text" icon={<CommentOutlined />} className={styles.headerButton} />
    </Popover>
  );

  // 顶部标题
  const chatHeader = (
    <div className={styles.chatHeader}>
      <div className={styles.headerTitle}>✨ 保护散助手</div>
      <Space size={0}>
        <Button
          type="text"
          disabled={loading}
          icon={<PlusOutlined />}
          onClick={handleNewSessionFn}
          className={styles.headerButton}
        />
        {sessionPopover}
        <Button
          disabled={loading}
          type="text"
          icon={<CloseOutlined />}
          onClick={() => setCopilotOpen(false)}
          className={styles.headerButton}
        />
      </Space>
    </div>
  );
  // 聊天列表
  const newChatList = ( isLoading: boolean ) => {

    const newChatListItems = chatList.map((item: any, index: number) => {
      if (item.type === 'temp') {
        return [
          { role: 'user', content: item.send },
          { role: 'assistant', content: (<Space><Spin size="small" /> 正在生成内容...</Space>) }
        ];
      }
      
      return [
        { role: 'user', content: item.send },
        { 
          role: 'assistant', 
          content: (
            <div className="copilot-markdown">
              {renderReasoningCollapse(item.response.output.thoughts, true,  index === chatList.length - 1 ? isLoading : false)}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.response.output.text}</ReactMarkdown>
            </div> 
          )
        },
      ];
    });
    
    return (
      <div  className={styles.chatList} ref={chatListRef}>
        <div>
          <Bubble.List
            style={{ height: '100%', paddingInline: 16 }}
            items={newChatListItems.flat()}
            roles={{
              user: { placement: 'end' },
              assistant: { placement: 'start' }
            }}
          >
          </Bubble.List>
        </div>
      </div>
    )
  }
  // 底部按钮
  const chatSender = (
    <div className={styles.chatSend}>
      <div className={styles.sendAction}>
        {/* 分析按钮 */}
        <Button
          icon={<ScheduleOutlined />}
          onClick={() => handleUserSubmit('分析仓位')}
          disabled={loading}
        >
          分析
        </Button>
      </div>
      {/* 输入框 */}
      <Suggestion items={[]} onSelect={(itemVal) => setInputValue(`[${itemVal}]:`)}>
        {({ onTrigger, onKeyDown }) => (
          <Sender
            loading={loading}
            value={inputValue}
            onChange={(v) => {
              onTrigger(v === '/');
              setInputValue(v);
            }}
            onSubmit={() => {
              handleUserSubmit(inputValue);
              setInputValue('');
            }}
            onCancel={() => {
              abortController?.abort();
            }}
            placeholder="Ask or input / use skills"
            onKeyDown={onKeyDown}
          />
        )}
      </Suggestion>
    </div>
  );

  return (
    <>
      {contextHolder}
      <div className={styles.copilotChat} style={{ visibility: copilotOpen ? 'visible' : 'hidden', width: 400, height: '100%'}}>
        {chatHeader}
        {newChatList(loading)}
        {chatSender}
      </div>
    </>
  );
};

// Collapse 折叠渲染推理气泡
const renderReasoningCollapse = (content: string, expanded = false, isLoading = false) => {
  return (
  <Collapse
    size="small"
    bordered={false}
    style={{ background: 'transparent', marginBottom: 4 }}
    {...(expanded ? { defaultActiveKey: ['1'] } : [])}
  >
    <Collapse.Panel
      header={
        <span style={{ color: '#888', fontStyle: 'italic', fontWeight: 500 }}>
          推理过程（点击展开/收起）
        </span>
      }
      key="1"
    >
      <div
        style={{
          background: '#f5f5f5',
          border: '1px dashed #bfbfbf',
          borderRadius: 8,
          padding: '8px 12px',
          color: '#888',
          fontStyle: 'italic',
        }}
      >
        <ThoughtChain content={content} isLoading={isLoading}/>
      </div>
    </Collapse.Panel>
  </Collapse>
  )
}

export default Copilot; 