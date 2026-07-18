import React from 'react';

/**
 * Lightweight, safe markdown renderer for chat bubbles.
 * Supports **bold**, *italic*, line breaks, and simple bullet/numbered lists.
 * Never interprets HTML — only React elements from a constrained grammar.
 */

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // **bold** first, then *italic* (single asterisks that are not part of **)
  const tokenRe = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <em key={`${keyPrefix}-i-${i++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let bulletItems: string[] | null = null;
  let numberItems: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'p', text: paragraph.join('\n') });
    paragraph = [];
  };

  const flushLists = () => {
    if (bulletItems) {
      blocks.push({ type: 'ul', items: bulletItems });
      bulletItems = null;
    }
    if (numberItems) {
      blocks.push({ type: 'ol', items: numberItems });
      numberItems = null;
    }
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);

    if (bullet) {
      flushParagraph();
      if (numberItems) {
        blocks.push({ type: 'ol', items: numberItems });
        numberItems = null;
      }
      if (!bulletItems) bulletItems = [];
      bulletItems.push(bullet[1]);
      continue;
    }

    if (numbered) {
      flushParagraph();
      if (bulletItems) {
        blocks.push({ type: 'ul', items: bulletItems });
        bulletItems = null;
      }
      if (!numberItems) numberItems = [];
      numberItems.push(numbered[1]);
      continue;
    }

    if (line.trim() === '') {
      flushLists();
      flushParagraph();
      continue;
    }

    flushLists();
    paragraph.push(line);
  }

  flushLists();
  flushParagraph();
  return blocks;
}

export const SimpleMarkdown: React.FC<{ text: string; className?: string }> = ({
  text,
  className = '',
}) => {
  const blocks = parseBlocks(text);

  return (
    <div className={`leading-relaxed space-y-2 ${className}`.trim()}>
      {blocks.map((block, bi) => {
        if (block.type === 'p') {
          return (
            <p key={`p-${bi}`} className="whitespace-pre-wrap">
              {parseInline(block.text, `p${bi}`)}
            </p>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={`ul-${bi}`} className="list-disc pl-4 space-y-1">
              {block.items.map((item, ii) => (
                <li key={`ul-${bi}-${ii}`}>{parseInline(item, `ul${bi}-${ii}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={`ol-${bi}`} className="list-decimal pl-4 space-y-1">
            {block.items.map((item, ii) => (
              <li key={`ol-${bi}-${ii}`}>{parseInline(item, `ol${bi}-${ii}`)}</li>
            ))}
          </ol>
        );
      })}
    </div>
  );
};

export default SimpleMarkdown;
