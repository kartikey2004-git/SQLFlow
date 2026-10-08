"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";

type MonacoEditorInstance = Parameters<OnMount>[0];

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

const SQL_KEYWORDS =
  /^(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|DISTINCT|ALL|EXISTS|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|AS|GROUP|BY|HAVING|ORDER|ASC|DESC|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|DROP|ALTER|ADD|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CHECK|DEFAULT|AUTO_INCREMENT|INT|INTEGER|SMALLINT|BIGINT|DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE|CHAR|VARCHAR|TEXT|DATE|TIME|DATETIME|TIMESTAMP|BOOLEAN|BOOL)\b/i;

const editorOptions = (disabled: boolean) => ({
  ariaLabel: "SQL query editor",
  readOnly: disabled,
  domReadOnly: disabled,
  selectOnLineNumbers: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace",
  lineNumbers: "on" as const,
  renderLineHighlight: "line" as const,
  automaticLayout: true,
  wordWrap: "on" as const,
  lineNumbersMinChars: 3,
  padding: { top: 16, bottom: 16 },
  contextmenu: !disabled,
  quickSuggestions: !disabled,
  suggestOnTriggerCharacters: !disabled,
  parameterHints: { enabled: !disabled },
  folding: !disabled,
  renderWhitespace: "selection" as const,
  guides: {
    indentation: false,
    bracketPairs: false,
    highlightActiveIndentation: false,
  },
  suggest: {
    showKeywords: true,
    showSnippets: true,
  },
  wordBasedSuggestions: "off" as const,
});

export default function SQLEditor({
  value,
  onChange,
  onRun,
  disabled = false,
  placeholder = "Write your SQL query here...",
  ariaLabel = "SQL query editor",
}: SQLEditorProps) {
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const onRunRef = useRef(onRun);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  const options = useMemo(() => ({ ...editorOptions(disabled), ariaLabel }), [disabled, ariaLabel]);

  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      monaco.languages.register({ id: "sql" });
      monaco.languages.setMonarchTokensProvider("sql", {
        tokenizer: {
          root: [
            [SQL_KEYWORDS, "keyword"],
            [/^(TRUE|FALSE|UNKNOWN)\b/i, "keyword"],
            [/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(/, "identifier"],
            [/^[a-zA-Z_][a-zA-Z0-9_]*/, "identifier"],
            [/^\s*--.*$/, "comment"],
            [/^\s*\/\*/, "comment", "@comment"],
            [/^\s*"[^"]*"/, "string"],
            [/^\s*'[^']*'/, "string"],
            [/^\s*\d+(\.\d+)?/, "number"],
            [/^\s*[=<>!+\-*/%&|^~,]/, "operator"],
            [/^\s*[(),;]/, "delimiter"],
          ],
          comment: [
            [/[^/*]+/, "comment"],
            [/\*\//, "comment", "@pop"],
            [/[/*]/, "comment"],
          ],
        },
      });

      editor.addAction({
        id: "run-sql",
        label: "Run SQL query",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => onRunRef.current?.(),
      });

      if (!editor.getValue() && placeholder) {
        editor.createDecorationsCollection([
          {
            range: new monaco.Range(1, 1, 1, 1),
            options: {
              className: "editor-placeholder",
              isWholeLine: true,
              afterContentClassName: "editor-placeholder-content",
            },
          },
        ]);
      }
    },
    [placeholder],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    const handleResize = () => editorRef.current?.layout();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleChange = useCallback(
    (next: string | undefined) => {
      onChange(next ?? "");
    },
    [onChange],
  );

  return (
    <div className="sql-editor-wrapper">
      <Editor
        height="100%"
        language="sql"
        defaultValue={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme="vs"
        options={options}
        loading={
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">Loading editor...</div>
        }
      />
      <style jsx>{`
        .sql-editor-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
        }

        :global(.editor-placeholder) {
          color: #a3a3a3;
          font-style: italic;
          pointer-events: none;
        }

        :global(.editor-placeholder-content) {
          position: absolute;
          top: 16px;
          left: 16px;
          color: #a3a3a3;
          font-style: italic;
          pointer-events: none;
          z-index: 1;
        }

        :global(.monaco-editor) {
          outline: none;
        }

        :global(.monaco-editor .monaco-editor-background),
        :global(.monaco-editor .margin) {
          background-color: #ffffff;
        }

        :global(.monaco-editor .current-line) {
          background-color: #f5fbf8;
          border: 0;
        }

        :global(.monaco-editor .line-numbers) {
          color: #737373;
        }

        :global(.monaco-editor .cursor) {
          background-color: #0a0a0a;
        }

        :global(.monaco-editor .keyword) {
          color: #047857;
          font-weight: 600;
        }

        :global(.monaco-editor .string) {
          color: #0f766e;
        }

        :global(.monaco-editor .number) {
          color: #b45309;
        }

        :global(.monaco-editor .comment) {
          color: #737373;
          font-style: italic;
        }

        :global(.monaco-editor .identifier) {
          color: #0a0a0a;
        }

        :global(.monaco-editor .operator),
        :global(.monaco-editor .delimiter) {
          color: #525252;
        }

        :global(.monaco-editor .selected-text) {
          background-color: rgba(5, 150, 105, 0.2);
        }

        :global(.monaco-editor .selection-highlight) {
          background-color: rgba(5, 150, 105, 0.1);
        }
      `}</style>
    </div>
  );
}
