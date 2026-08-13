import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

/** Botón de copiar código con feedback visual */
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1 rounded bg-[#252B34] hover:bg-[#2f3640] text-[#858C98] hover:text-[#E6E9ED] transition opacity-0 group-hover:opacity-100"
      title="Copiar código"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#4FD49A]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // ── Code blocks & inline code ──
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');

          if (match) {
            return (
              <div className="relative group my-2 rounded-md overflow-hidden border border-[#252B34]">
                {/* Language badge */}
                <div className="flex items-center justify-between px-3 py-1 bg-[#13171D] border-b border-[#252B34]">
                  <span className="text-[9px] font-mono font-bold text-[#8B7CFF] uppercase tracking-wider">
                    {match[1]}
                  </span>
                </div>
                <CopyButton text={codeString} />
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: '12px 14px',
                    fontSize: '11px',
                    lineHeight: '1.5',
                    background: '#0B0D10',
                    borderRadius: 0,
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }

          // Inline code
          return (
            <code
              className="px-1.5 py-0.5 rounded bg-[#1D222A] text-[#45C8DF] font-mono text-[10.5px] border border-[#252B34]"
              {...props}
            >
              {children}
            </code>
          );
        },

        // ── Headings ──
        h1: ({ children }) => (
          <h1 className="text-sm font-bold text-[#E6E9ED] mt-3 mb-1.5 pb-1 border-b border-[#252B34]">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-[13px] font-bold text-[#E6E9ED] mt-2.5 mb-1">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xs font-bold text-[#8B7CFF] mt-2 mb-1">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-xs font-semibold text-[#45C8DF] mt-1.5 mb-0.5">
            {children}
          </h4>
        ),

        // ── Paragraphs ──
        p: ({ children }) => (
          <p className="text-[11.5px] text-[#C8CCD4] leading-relaxed mb-1.5">
            {children}
          </p>
        ),

        // ── Links ──
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8B7CFF] hover:text-[#a99bff] underline underline-offset-2 transition"
          >
            {children}
          </a>
        ),

        // ── Lists ──
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-0.5 text-[11.5px] text-[#C8CCD4] ml-1 mb-1.5">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-0.5 text-[11.5px] text-[#C8CCD4] ml-1 mb-1.5">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">
            {children}
          </li>
        ),

        // ── Blockquotes ──
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#8B7CFF] pl-3 my-2 text-[11px] text-[#858C98] italic bg-[#13171D] rounded-r-md py-1.5 pr-2">
            {children}
          </blockquote>
        ),

        // ── Horizontal rule ──
        hr: () => (
          <hr className="border-[#252B34] my-2" />
        ),

        // ── Strong / Em ──
        strong: ({ children }) => (
          <strong className="font-bold text-[#E6E9ED]">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-[#858C98]">{children}</em>
        ),

        // ── Tables (GFM) ──
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 rounded-md border border-[#252B34]">
            <table className="w-full text-[10.5px] text-[#C8CCD4]">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[#13171D] text-[#858C98] font-semibold">
            {children}
          </thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-[#1D222A]">
            {children}
          </tbody>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-[#13171D]/50 transition">
            {children}
          </tr>
        ),
        th: ({ children }) => (
          <th className="px-2.5 py-1.5 text-left font-mono border-b border-[#252B34]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2.5 py-1.5">
            {children}
          </td>
        ),

        // ── Images ──
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt || ''}
            className="max-w-full rounded-md border border-[#252B34] my-2"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
