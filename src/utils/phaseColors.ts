export const PHASE_COLORS: Record<string, string> = {
  "0": "#94a3b8",
  "1": "#5b8fb9",
  "2": "#1e6b9a",
  "3": "#1e3a5f",
  "4": "#3C9A6E",
};

export const getCodeBadgeColors = (code: string) => {
  const fase = code.split('.')[0];
  switch (fase) {
    case '0': return 'bg-[#94a3b81a] text-[#94a3b8] border-[#94a3b833]';
    case '1': return 'bg-[#5b8fb91a] text-[#5b8fb9] border-[#5b8fb933]';
    case '2': return 'bg-[#1e6b9a1a] text-[#1e6b9a] border-[#1e6b9a33]';
    case '3': return 'bg-[#1e3a5f1a] text-[#1e3a5f] border-[#1e3a5f33]';
    case '4': return 'bg-[#3C9A6E1a] text-[#3C9A6E] border-[#3C9A6E33]';
    default: return 'bg-hh-ink/10 text-hh-ink border-hh-ink/20';
  }
};

export const getCodeBadgeStyle = (code: string) => {
  const fase = code.split('.')[0];
  const color = PHASE_COLORS[fase] || "#64748b";
  return {
    backgroundColor: `${color}15`,
    color: color,
    borderColor: `${color}30`,
  };
};

export const getFaseBadgeColors = (fase: string) => {
  switch (fase) {
    case '0': return { bg: 'bg-[#94a3b81a]', text: 'text-[#94a3b8]', border: 'border-[#94a3b833]' };
    case '1': return { bg: 'bg-[#5b8fb91a]', text: 'text-[#5b8fb9]', border: 'border-[#5b8fb933]' };
    case '2': return { bg: 'bg-[#1e6b9a1a]', text: 'text-[#1e6b9a]', border: 'border-[#1e6b9a33]' };
    case '3': return { bg: 'bg-[#1e3a5f1a]', text: 'text-[#1e3a5f]', border: 'border-[#1e3a5f33]' };
    case '4': return { bg: 'bg-[#3C9A6E1a]', text: 'text-[#3C9A6E]', border: 'border-[#3C9A6E33]' };
    default: return { bg: 'bg-hh-ui-100', text: 'text-hh-ink', border: 'border-hh-border' };
  }
};
