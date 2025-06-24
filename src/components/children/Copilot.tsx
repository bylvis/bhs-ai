import React, { useEffect, useRef, useState } from 'react';
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
import { Button, GetProp, GetRef, Popover, Space, Spin, message, Switch, Collapse } from 'antd';
import { useCopilotStyle } from '../styles/CopilotStyles';
import type { BubbleDataType, CopilotProps } from '../types/types';
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

// 定义 localStorage 的 key
const SESSION_LIST_KEY = 'copilot_session_list';
const MESSAGE_HISTORY_KEY = 'copilot_message_history';

const Copilot = (props: CopilotProps) => {
  const { copilotOpen, setCopilotOpen } = props;
  const { styles } = useCopilotStyle();
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [msgApi, contextHolder] = message.useMessage();

  const {
    sessionList, setSessionList,
    curSession, setCurSession,
    messageHistory, setMessageHistory
  } = useCopilotSession();

  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [messages, setMessages] = useState<(BubbleDataType & { type?: string })[]>([]);
  const [agentMode, setAgentMode] = useState(true);
  const [reasoningMode, setReasoningMode] = useState(false);
  const [reasoning, setReasoning] = useState<string | any[]>("");

  // 切换会话
  const handleSessionChange = (key: string) => {
    setCurSession(key);
    setResult('');
    setMessages(messageHistory[key] || []);
  };

  // 新建会话
  const handleNewSession = () => {
    const newKey = Date.now().toString();
    setCurSession(newKey);
    setMessages([]);
    setResult('');
  };

  // 挂载时自动新建会话
  useEffect(() => {
    handleNewSession();
  }, []);

  // 持久化 sessionList
  useEffect(() => {
    localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionList));
  }, [sessionList]);

  // 持久化 messageHistory
  useEffect(() => {
    localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(messageHistory));
  }, [messageHistory]);

  // 删除会话
  const handleDeleteSession = (key: string) => {
    if (sessionList.length === 1) {
      msgApi.warning('至少保留一个会话');
      return;
    }
    const newSessionList = sessionList.filter(item => item.key !== key);
    const newMessageHistory = { ...messageHistory };
    delete newMessageHistory[key];
    setSessionList(newSessionList);
    setMessageHistory(newMessageHistory);
    // 如果删除的是当前会话，切换到下一个或新建
    if (curSession === key) {
      if (newSessionList.length > 0) {
        setCurSession(newSessionList[0].key);
        setMessages(newMessageHistory[newSessionList[0].key] || []);
        setResult('');
      } else {
        handleNewSession();
      }
    }
  };

  // 模式切换：普通/智能体互斥，切回普通模式时自动关闭思考模式，避免参数混乱
  const handleAgentModeBtn = () => {
    setAgentMode(true);
    setReasoningMode(false);
  };

  // 思考模式独立切换
  const handleReasoningModeBtn = () => {
    setReasoningMode(true);
    setAgentMode(false);
  };

  // 支持自定义 url 的 handleUserSubmit
  const handleUserSubmit = async (val: string) => {
    if (loading) return; // 防止重复请求
    setLoading(true);
    setResult('');
    setReasoning('');
    const controller = new AbortController();
    setAbortController(controller);
    const isNewSession = !sessionList.some(item => item.key === curSession);
    const newMessages = [
      ...(messageHistory[curSession] || []),
      { role: 'user', content: val },
    ];
    setMessages(newMessages);
    let reasoningBuffer = '';
    let answerBuffer = '';
    let url, fetchBody;
    if (agentMode) {
      url = getApiBaseUrl() + '/ai/dashscope-proxy-stream';
      fetchBody = {
        prompt: val,
        has_thoughts: true // 仅 agent+reasoning 时传递
        // 其他参数可扩展
      };
    } else {
      if (reasoningMode) {
        url = getApiBaseUrl() + '/ai/chat/reasoning';
        fetchBody = { messages: newMessages };
      } else {
        url = getApiBaseUrl() + '/ai/chat/stream';
        fetchBody = { messages: newMessages };
      }
    }
    try {
      await fetchAIStreamWithAbort(
        fetchBody,
        (data) => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            // 兼容非JSON格式
            answerBuffer += data;
            setResult(answerBuffer);
            return;
          }
          if (parsed.type === 'reasoning') {
            if(agentMode){
              reasoningBuffer += JSON.stringify(parsed.content) + '[agent_reasoning]';
              setReasoning(reasoningBuffer);
            }else {
              reasoningBuffer += parsed.content;
              setReasoning(reasoningBuffer);
            }
          } else if (parsed.type === 'answer') {
            answerBuffer += parsed.content;
            setResult(answerBuffer);
          }
        },
        controller,
        url
      );
    } catch (e) {
      if (e.name === 'AbortError') {
        setResult(answerBuffer + '\n[已中断]');
      }
    }
    setAbortController(null);
    // 推理和答案分开展示
    const assistantMsgs: any[] = [];
    if (reasoningBuffer) {
      assistantMsgs.push({
        role: 'assistant',
        content: reasoningBuffer,
        type: 'reasoning',
      });
    }
    if (answerBuffer) {
      assistantMsgs.push({
        role: 'assistant',
        content: answerBuffer,
        type: 'answer',
      });
    }
    setMessageHistory(prev => ({
      ...prev,
      [curSession]: [
        ...newMessages,
        ...assistantMsgs
      ]
    }));
    setMessages([
      ...newMessages,
    ]);
    setLoading(false);
    // 首次提问时才加入 sessionList
    if (isNewSession) {
      setSessionList(list => [
        { key: curSession, label: val.slice(0, 20), group: 'Today' },
        ...list
      ]);
    } else {
      setSessionList(list =>
        list.map(item =>
          item.key === curSession && item.label === '新会话'
            ? { ...item, label: val.slice(0, 20) }
            : item
        )
      );
    }
  };

  // 顶部气泡
  const sessionPopover = (
    <Popover
      placement="bottom"
      content={
        <div style={{ minWidth: 200 }}>
          {sessionList.map((item) => (
            <div
              key={item.key}
              style={{
                padding: '8px 12px',
                background: item.key === curSession ? '#f0f0f0' : undefined,
                cursor: 'pointer',
                borderRadius: 4,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onClick={() => handleSessionChange(item.key)}
            >
              <span>{item.label}</span>
              {sessionList.length > 1 && (
                <CloseOutlined
                  style={{ marginLeft: 8, color: '#bbb', fontSize: 14, cursor: 'pointer' }}
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteSession(item.key);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      }
      trigger="click"
    >
      <Button type="text" icon={<CommentOutlined />} className={styles.headerButton} />
    </Popover>
  );

  // 顶部标题
  const chatHeader = (
    <div className={styles.chatHeader}>
      <div className={styles.headerTitle}>✨ 保护散助手</div>
      <Space size={0}>
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={handleNewSession}
          className={styles.headerButton}
        />
        {sessionPopover}
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={() => setCopilotOpen(false)}
          className={styles.headerButton}
        />
      </Space>
    </div>
  );

  // 聊天列表
  const chatList = (
    <div className={styles.chatList}>
      {messages.length || reasoning || result ? (
        <Bubble.List
          style={{ height: '100%', paddingInline: 16 }}
          items={[
            ...messages.filter(msg => msg.content && msg.content !== '').map((msg) => {
              // 推理气泡
              if (msg.type === 'reasoning') {
                return {
                  ...msg,
                  content: renderReasoningCollapse(msg.content, false),
                };
              }
              // 答案气泡
              if (msg.type === 'answer') {
                return {
                  ...msg,
                  content: (
                    <div className="copilot-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ),
                };
              }
              return msg;
            }),
            // 推理气泡
            reasoning && {
              role: 'assistant',
              content:  renderReasoningCollapse(renderReasoning(reasoning), true),
              type: 'reasoning',
            },
            // 答案气泡
            result && { role: 'assistant', content: (
              <div className="copilot-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
            ), type: 'answer' },
            // 加载中气泡
            loading && !result && { role: 'assistant', content: (<Space><Spin size="small" /> 正在生成内容...</Space>), type: 'loading' },
          ].filter(Boolean) as any[]}
          roles={{
            assistant: {
              placement: 'start',
              footer: (item) => {
                const text = item?.props?.children?.props?.children
                if(typeof text === 'string' || typeof text?.props?.children === 'string'){
                  // 复制按钮
                  return(
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(typeof text === 'string' ? text : text.props.children);
                        msgApi.success('已复制');
                      }}
                    />
                  )
                }
                return null;
              },
              loadingRender: () => (
                <Space>
                  <Spin size="small" />
                  正在生成内容...
                </Space>
              ),
            },
            user: { placement: 'end' },
          }}
        />
      ) : (
        <div style={{ textAlign: 'center', color: '#aaa', marginTop: 40 }}>
          请输入你的问题开始对话
        </div>
      )}
    </div>
  );

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
        {/* 智能体模式按钮 */}
        <Button
          type={agentMode ? 'primary' : 'default'}
          onClick={handleAgentModeBtn}
          disabled={loading}
          style={{ marginLeft: 8 }}
        >
          智能体模式
        </Button>
        {/* 思考模式按钮 */}
        <Button
          type={reasoningMode ? 'primary' : 'default'}
          onClick={handleReasoningModeBtn}
          disabled={loading}
          style={{ marginLeft: 8 }}
        >
          思考模式
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
        {chatList}
        {chatSender}
      </div>
    </>
  );
};

// Collapse 折叠渲染推理气泡
const renderReasoningCollapse = (content: string, expanded = false) => {
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
        { content.includes('[agent_reasoning]') ? renderAgentReasoning(content) : content }
      </div>
    </Collapse.Panel>
  </Collapse>
  )
}

// 渲染智能体推理过程
const renderAgentReasoning = (content: string) => {
  let agentReasoningArr: any[] = content.split('[agent_reasoning]').map(item=>{
    try {
      return JSON.parse(item)
    } catch (e) {
      // console.log(e);
    }
  }).flat()
  agentReasoningArr = agentReasoningArr.filter(item=>item)
  return <ThoughtChain content={agentReasoningArr} />
}

// 推理渲染：直接返回字符串
const renderReasoning = (reasoning) => reasoning;

export default Copilot; 