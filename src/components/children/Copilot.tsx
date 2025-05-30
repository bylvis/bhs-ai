import React, { useEffect, useRef, useState } from 'react';
import {
  Attachments,
  type AttachmentsProps,
  Bubble,
  Conversations,
  Prompts,
  Sender,
  Suggestion,
  Welcome,
  useXAgent,
  useXChat,
} from '@ant-design/x';
import {
  AppstoreAddOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  CommentOutlined,
  CopyOutlined,
  DislikeOutlined,
  LikeOutlined,
  OpenAIFilled,
  PaperClipOutlined,
  PlusOutlined,
  ProductOutlined,
  ReloadOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { Button, GetProp, GetRef, Popover, Space, Spin, message } from 'antd';
import dayjs from 'dayjs';
import { useCopilotStyle } from '../styles/CopilotStyles';
import type { BubbleDataType, CopilotProps } from '../types/types';

// 修改 fetchAIStream 支持 abort
async function fetchAIStreamWithAbort(messages: any[], onData: (data: string) => void, controller: AbortController) {
  const url = 'http://47.116.185.133:3000/ai/chat/stream'
  // const url = 'http://localhost:3000/ai/chat/stream'
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
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
  const { copilotOpen, setCopilotOpen } = props;
  const { styles } = useCopilotStyle();
  const attachmentsRef = useRef<GetRef<typeof Attachments>>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [msgApi, contextHolder] = message.useMessage();

  // ==================== State ====================
  const [sessionList, setSessionList] = useState([
    { key: '1', label: '新会话', group: 'Today' }
  ]);
  const [curSession, setCurSession] = useState('1');
  const [messageHistory, setMessageHistory] = useState<{ [key: string]: any[] }>({ '1': [] });

  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [files, setFiles] = useState<GetProp<AttachmentsProps, 'items'>>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [messages, setMessages] = useState<any[]>([]);

  // ==================== Event ====================
  const handleSessionChange = (key: string) => {
    setCurSession(key);
    setResult('');
    setMessages(messageHistory[key] || []);
  };

  const handleNewSession = () => {
    const newKey = Date.now().toString();
    setSessionList([{ key: newKey, label: '新会话', group: 'Today' }, ...sessionList]);
    setMessageHistory(prev => ({ ...prev, [newKey]: [] }));
    setCurSession(newKey);
    setMessages([]);
    setResult('');
  };

  // 修改 handleUserSubmit 支持 abort
  const handleUserSubmit = async (val: string) => {
    setLoading(true);
    setResult('');
    const controller = new AbortController();
    setAbortController(controller);
    const newMessages = [
      ...(messageHistory[curSession] || []),
      { role: 'user', content: val },
    ];
    setMessages(newMessages);
    let assistantContent = '';
    try {
      await fetchAIStreamWithAbort(newMessages, (data) => {
        assistantContent += data;
        setResult(assistantContent);
      }, controller);
    } catch (e) {
      if (e.name === 'AbortError') {
        setResult(assistantContent + '\n[已中断]');
      }
    }
    setAbortController(null);
    setMessageHistory(prev => ({
      ...prev,
      [curSession]: [
        ...newMessages,
        { role: 'assistant', content: assistantContent }
      ]
    }));
    setMessages([
      ...newMessages,
      { role: 'assistant', content: assistantContent }
    ]);
    setLoading(false);
    setSessionList(list =>
      list.map(item =>
        item.key === curSession && item.label === '新会话'
          ? { ...item, label: val.slice(0, 20) }
          : item
      )
    );
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
              }}
              onClick={() => handleSessionChange(item.key)}
            >
              {item.label}
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
      {messages.length ? (
        <Bubble.List
          style={{ height: '100%', paddingInline: 16 }}
          items={[
            ...messages,
            loading && { role: 'assistant', content: result },
          ].filter(Boolean)}
          roles={{
            assistant: {
              placement: 'start',
              footer: (item) => (
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(item.content);
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
        >
          分析
        </Button>
        <Button
          icon={<ProductOutlined />}
          onClick={() => handleUserSubmit('获取今日行情')}
        >
          获取今日行情
        </Button>
        <Button icon={<AppstoreAddOutlined />}>More</Button>
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

export default Copilot; 