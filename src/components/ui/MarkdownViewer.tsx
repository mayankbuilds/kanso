"use client";

import React, { useState } from "react";
import { Check, Copy, CheckSquare, Square } from "lucide-react";

interface MarkdownViewerProps {
  content: string;
  className?: string;
  onToggleCheckbox?: (lineIndex: number, nextChecked: boolean) => void;
}

/**
 * Parses inline formatting: bold (**text**), italic (*text*), code (`code`), and links ([text](url))
 * Returns an array of ReactNodes safely without dangerouslySetInnerHTML.
 */
function renderInlineFormatting(text: string, keyPrefix: string): React.ReactNode[] {
  // Regex matches:
  // 1. Links: [label](url)
  // 2. Inline code: `code`
  // 3. Bold: **text**
  // 4. Italic: *text* or _text_
  const tokenRegex =
    /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;

    // 1. Link [label](url)
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const [, label, url] = match;
        const isSafe = /^https?:\/\//i.test(url) || url.startsWith("/");
        return isSafe ? (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:opacity-80 transition"
          >
            {label}
          </a>
        ) : (
          <span key={key}>{label}</span>
        );
      }
    }

    // 2. Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-surface-muted border border-border-subtle text-foreground font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // 3. Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={key} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // 4. Italic: *text* or _text_
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      return (
        <em key={key} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Plain text
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

/**
 * Fenced Code Block component with Copy button
 */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-2 rounded-xl border border-border-subtle bg-surface-muted overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-border-subtle text-[10px] text-muted-foreground font-mono">
        <span>{language || "code"}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1 hover:text-foreground transition cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-accent" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-foreground font-mono text-[11px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function MarkdownViewer({
  content,
  className = "",
  onToggleCheckbox,
}: MarkdownViewerProps) {
  if (!content.trim()) {
    return (
      <div className={`text-muted-foreground italic text-xs ${className}`}>
        Empty note
      </div>
    );
  }

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for fenced code block start/end
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // End of code block
        renderedElements.push(
          <CodeBlock
            key={`code-block-${i}`}
            code={codeBuffer.join("\n")}
            language={codeLanguage}
          />
        );
        codeBuffer = [];
        codeLanguage = "";
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      renderedElements.push(
        <hr
          key={`hr-${i}`}
          className="border-border-subtle my-2.5"
        />
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      renderedElements.push(
        <h3
          key={`h3-${i}`}
          className="text-xs font-bold text-foreground mt-2 mb-1"
        >
          {renderInlineFormatting(trimmed.slice(4), `h3-${i}`)}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      renderedElements.push(
        <h2
          key={`h2-${i}`}
          className="text-sm font-bold text-foreground mt-2.5 mb-1"
        >
          {renderInlineFormatting(trimmed.slice(3), `h2-${i}`)}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      renderedElements.push(
        <h1
          key={`h1-${i}`}
          className="text-base font-bold text-foreground mt-3 mb-1"
        >
          {renderInlineFormatting(trimmed.slice(2), `h1-${i}`)}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      renderedElements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-accent pl-3 text-xs italic text-muted-foreground my-1.5"
        >
          {renderInlineFormatting(trimmed.slice(2), `quote-${i}`)}
        </blockquote>
      );
      continue;
    }

    // Task checkbox item: - [ ] or - [x]
    const taskMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const isChecked = taskMatch[1].toLowerCase() === "x";
      const itemText = taskMatch[2];
      const lineIndex = i;

      renderedElements.push(
        <div
          key={`task-${i}`}
          className="flex items-start gap-2 text-xs my-1"
        >
          <button
            type="button"
            disabled={!onToggleCheckbox}
            onClick={() => onToggleCheckbox?.(lineIndex, !isChecked)}
            className={`mt-0.5 shrink-0 transition ${
              onToggleCheckbox ? "cursor-pointer" : "cursor-default"
            }`}
          >
            {isChecked ? (
              <CheckSquare className="w-3.5 h-3.5 text-accent" />
            ) : (
              <Square className="w-3.5 h-3.5 text-muted-foreground hover:text-accent" />
            )}
          </button>
          <span
            className={`${
              isChecked
                ? "line-through text-muted-foreground"
                : "text-foreground"
            }`}
          >
            {renderInlineFormatting(itemText, `task-text-${i}`)}
          </span>
        </div>
      );
      continue;
    }

    // Unordered List item: - or *
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      renderedElements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 text-xs my-0.5 ml-2">
          <span className="text-accent font-bold mt-0.5">•</span>
          <span className="text-foreground/90">
            {renderInlineFormatting(trimmed.slice(2), `bullet-text-${i}`)}
          </span>
        </div>
      );
      continue;
    }

    // Numbered list: 1. 2. etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      renderedElements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 text-xs my-0.5 ml-2">
          <span className="font-mono text-muted-foreground text-[11px] shrink-0 mt-0.5">
            {numMatch[1]}.
          </span>
          <span className="text-foreground/90">
            {renderInlineFormatting(numMatch[2], `num-text-${i}`)}
          </span>
        </div>
      );
      continue;
    }

    // Empty line
    if (!trimmed) {
      renderedElements.push(<div key={`blank-${i}`} className="h-1.5" />);
      continue;
    }

    // Normal Paragraph line
    renderedElements.push(
      <p
        key={`p-${i}`}
        className="text-xs text-foreground/90 leading-relaxed my-0.5"
      >
        {renderInlineFormatting(rawLine, `p-text-${i}`)}
      </p>
    );
  }

  // If code block wasn't closed at end of string
  if (inCodeBlock && codeBuffer.length > 0) {
    renderedElements.push(
      <CodeBlock
        key="code-block-unclosed"
        code={codeBuffer.join("\n")}
        language={codeLanguage}
      />
    );
  }

  return (
    <div className={`space-y-0.5 ${className}`}>
      {renderedElements}
    </div>
  );
}
