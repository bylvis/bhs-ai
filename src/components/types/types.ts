export type BubbleDataType = {
  role: string;
  content: string;
};

export interface CopilotProps {
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
} 