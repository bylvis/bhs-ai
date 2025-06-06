// 格式化 JSON 字符串或对象
export default function formatJson(val: any): string {
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