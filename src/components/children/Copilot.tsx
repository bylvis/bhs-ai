import React, { useEffect, useRef, useState } from 'react';
import {
  Attachments,
  type AttachmentsProps,
  Bubble,
  Sender,
  Suggestion
} from '@ant-design/x';
import {
  CloseOutlined,
  CloudUploadOutlined,
  CommentOutlined,
  CopyOutlined,
  PaperClipOutlined,
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
  const attachmentsRef = useRef<GetRef<typeof Attachments>>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [msgApi, contextHolder] = message.useMessage();

  // ==================== State ====================
  const [sessionList, setSessionList] = useState(() => {
    const stored = localStorage.getItem(SESSION_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [curSession, setCurSession] = useState('');
  const [messageHistory, setMessageHistory] = useState(() => {
    const stored = localStorage.getItem(MESSAGE_HISTORY_KEY);
    return stored ? JSON.parse(stored) : {};
  });

  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [files, setFiles] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [messages, setMessages] = useState<(BubbleDataType & { type?: string })[]>([]);
  const [agentMode, setAgentMode] = useState(true);
  const [reasoningMode, setReasoningMode] = useState(false);
  const [reasoning, setReasoning] = useState<string | any[]>("");
  // ==================== Event ====================
  const handleSessionChange = (key: string) => {
    setCurSession(key);
    setResult('');
    setMessages(messageHistory[key] || []);
  };

  const handleNewSession = () => {
    const newKey = Date.now().toString();
    setCurSession(newKey);
    setMessages([]);
    setResult('');
    // 不立即加入 sessionList/messageHistory，等首次提问时再加
  };

  // 挂载时自动新建会话
  useEffect(() => {
    handleNewSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

          if (reasoningMode) {
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
          } else {
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

  const onPasteFile = (_: File, files: FileList) => {
    for (const file of files) {
      attachmentsRef.current?.upload(file);
    }
    setAttachmentsOpen(true);
  };

  // ==================== Nodes ====================
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
  const chatList = (
    <div className={styles.chatList}>
      {messages.length || reasoning || result ? (
        <Bubble.List
          style={{ height: '100%', paddingInline: 16 }}
          items={[
            ...messages.filter(msg => msg.content && msg.content !== '').map((msg) => {
              if (msg.type === 'reasoning') {
                return {
                  ...msg,
                  content: renderReasoningCollapse(msg.content, false),
                };
              }
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
            reasoning && {
              role: 'assistant',
              content:  renderReasoningCollapse(renderReasoning(reasoning), true),
              type: 'reasoning',
            },
            result && { role: 'assistant', content: (
              <div className="copilot-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </div>
            ), type: 'answer' },
            loading && !result && { role: 'assistant', content: (<Space><Spin size="small" /> 正在生成内容...</Space>), type: 'loading' },
          ].filter(Boolean) as any[]}
          roles={{
            assistant: {
              placement: 'start',
              footer: (item) => (
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    // 兼容 content 可能为 React 元素
                    const text = typeof item.content === 'string'
                      ? item.content
                      : (item.content?.props?.children
                          ? Array.isArray(item.content.props.children)
                            ? item.content.props.children.map(child => typeof child === 'string' ? child : '').join('')
                            : item.content.props.children
                          : '');
                    navigator.clipboard.writeText(text);
                    msgApi.success('已复制');
                  }}
                />
              ),
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
  const sendHeader = (
    <Sender.Header
      title="Upload File"
      styles={{ content: { padding: 0 } }}
      open={attachmentsOpen}
      onOpenChange={setAttachmentsOpen}
      forceRender
    >
      <Attachments
        ref={attachmentsRef}
        beforeUpload={() => false}
        items={files}
        onChange={({ fileList }) => setFiles(fileList)}
        placeholder={(type) =>
          type === 'drop'
            ? { title: 'Drop file here' }
            : {
                icon: <CloudUploadOutlined />,
                title: 'Upload files',
                description: 'Click or drag files to this area to upload',
              }
        }
      />
    </Sender.Header>
  );
  const chatSender = (
    <div className={styles.chatSend}>
      <div className={styles.sendAction}>
        <Button
          icon={<ScheduleOutlined />}
          onClick={() => handleUserSubmit('分析仓位')}
          disabled={loading}
        >
          分析
        </Button>
        <Button
          type={agentMode ? 'primary' : 'default'}
          onClick={handleAgentModeBtn}
          disabled={loading}
          style={{ marginLeft: 8 }}
        >
          智能体模式
        </Button>
        <Button
          type={reasoningMode ? 'primary' : 'default'}
          onClick={handleReasoningModeBtn}
          disabled={loading}
          style={{ marginLeft: 8 }}
        >
          思考模式
        </Button>
      </div>
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
            allowSpeech
            placeholder="Ask or input / use skills"
            onKeyDown={onKeyDown}
            header={sendHeader}
            prefix={
              <Button
                type="text"
                icon={<PaperClipOutlined style={{ fontSize: 18 }} />}
                onClick={() => setAttachmentsOpen(!attachmentsOpen)}
              />
            }
            onPasteFile={onPasteFile}
            actions={(_, info) => {
              const { SendButton, LoadingButton, SpeechButton } = info.components;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <SpeechButton className={styles.speechButton} />
                  {loading ? <LoadingButton type="default" /> : <SendButton type="primary" />}
                </div>
              );
            }}
          />
        )}
      </Suggestion>
    </div>
  );

  // 持久化 sessionList
  useEffect(() => {
    localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionList));
  }, [sessionList]);

  // 持久化 messageHistory
  useEffect(() => {
    localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(messageHistory));
  }, [messageHistory]);

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
  console.log(547, content);
  
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

// 辅助函数：格式化 JSON 字符串或对象
function formatJson(val: any) {
  if (!val) return '';
  try {
    if (typeof val === 'string') {
      return JSON.stringify(JSON.parse(val), null, 2);
    }
    return JSON.stringify(val, null, 2);
  } catch {
    return val;
  }
}

export default Copilot; 