export interface CopilotProps {
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
} 

export interface ObservationItem {
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

export interface MockContentProps {
  observation?: string; // JSON 字符串，内容为 ObservationItem[]
  action_input_stream?: string;
  arguments?: string;
  action_name?: string;
  action_type?: string;
  content?: string;
  thought?: string;
}