import { useState, useEffect } from 'react';

const SESSION_LIST_KEY = 'copilot_session_list';
const MESSAGE_HISTORY_KEY = 'copilot_message_history';

export function useCopilotSession() {
  const [sessionList, setSessionList] = useState<any[]>(() => {
    const stored = localStorage.getItem(SESSION_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [curSession, setCurSession] = useState('');
  const [messageHistory, setMessageHistory] = useState<Record<string, any[]>>(() => {
    const stored = localStorage.getItem(MESSAGE_HISTORY_KEY);
    return stored ? JSON.parse(stored) : {};
  });

  useEffect(() => {
    localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionList));
  }, [sessionList]);

  useEffect(() => {
    localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(messageHistory));
  }, [messageHistory]);

  return {
    sessionList,
    setSessionList,
    curSession,
    setCurSession,
    messageHistory,
    setMessageHistory,
  };
}
