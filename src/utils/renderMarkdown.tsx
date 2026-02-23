import React from 'react';

export function renderSimpleMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    let processed: React.ReactNode = line;

    const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
    if (boldParts.length > 1) {
      processed = boldParts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    }

    if (i > 0) {
      elements.push(<br key={`br-${i}`} />);
    }

    if (Array.isArray(processed)) {
      elements.push(<React.Fragment key={`line-${i}`}>{processed}</React.Fragment>);
    } else {
      elements.push(<React.Fragment key={`line-${i}`}>{processed}</React.Fragment>);
    }
  });

  return <>{elements}</>;
}
