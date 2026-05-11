import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', html);

export interface CodeBlockProps {
    language: string;
    value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const displayLanguage = language || 'text';

    return (
        <div className="my-6 overflow-hidden rounded-xl border border-slate-700/50 bg-[#1e1e1e] shadow-xl">
            <div className="flex items-center justify-between bg-[#2d2d2d] px-4 py-2 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-rose-500/80"></div>
                        <div className="h-3 w-3 rounded-full bg-amber-500/80"></div>
                        <div className="h-3 w-3 rounded-full bg-emerald-500/80"></div>
                    </div>
                    <span className="ml-2 text-xs font-mono font-medium text-slate-400 capitalize">
                        {displayLanguage}
                    </span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-md p-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? '已复制' : '复制'}</span>
                </button>
            </div>
            <div className="relative text-sm">
                <SyntaxHighlighter
                    language={language.toLowerCase()}
                    style={vscDarkPlus}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'transparent',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                    }}
                    showLineNumbers={true}
                    lineNumberStyle={{
                        minWidth: '2.5em',
                        paddingRight: '1em',
                        color: '#6e7681',
                        textAlign: 'right',
                        borderRight: '1px solid #30363d',
                        marginRight: '1em'
                    }}
                >
                    {value.replace(/\n$/, '')}
                </SyntaxHighlighter>
            </div>
        </div>
    );
};
