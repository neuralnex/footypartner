"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NarrativeUpdate {
  id: string;
  timestamp: string;
  phaseTitle: string;
  content: string;
  scenarios: string[];
}

function renderMarkdownLite(md: string) {

  const parts = md.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*/.test(p)) {
      return <strong key={i}>{p.replace(/\*\*/g, '')}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

export default function NarrativeFeed({ updates }: { updates: NarrativeUpdate[] }) {
  if (!updates || updates.length === 0) {
    return <div className="text-neutral-400">No narrative yet.</div>;
  }

  return (
    <div className="space-y-4">
      {updates.map((u) => (
        <article key={u.id} className="bg-neutral-900/40 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-neutral-50 font-semibold">{u.phaseTitle}</h3>
            <time className="text-xs text-neutral-400">{new Date(u.timestamp).toLocaleTimeString()}</time>
          </div>
          <div className="mt-2 text-neutral-200 text-sm leading-relaxed prose prose-invert prose-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{u.content}</ReactMarkdown>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {u.scenarios.map((s, idx) => (
              <button
                key={idx}
                className="px-3 py-1 rounded-md text-sm bg-neutral-900/50 hover:bg-neutral-800 border border-neutral-800 text-neutral-100"
              >
                {s}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
