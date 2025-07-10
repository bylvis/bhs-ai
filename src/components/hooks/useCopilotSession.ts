import { useEffect, useState } from 'react';

const SESSION_LIST_KEY = 'copilot_session_list';

export const useCopilotSession = () => {
  const [sessionList, setSessionList] = useState(() => {
    const savedSessionList = localStorage.getItem(SESSION_LIST_KEY);
    return savedSessionList ? JSON.parse(savedSessionList) : [];
  });

  useEffect(() => {
    localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionList));
  }, [sessionList]);

  const handleNewSession = (key: string) => {
    setSessionList([...sessionList, {
      key: key,
      label: key
    }]);
  };

  const deleteSession = (key: string) => {
    setSessionList(sessionList.filter((item: any) => item.key !== key));
  };

  return { sessionList, handleNewSession, deleteSession };
};
