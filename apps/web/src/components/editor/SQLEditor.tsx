"use client";

import { useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";

// Derived from OnMount's own parameter type (rather than importing
// `monaco-editor` directly) so it always matches whichever copy of
// monaco-editor's types @monaco-editor/react itself resolves against -
// the package appears twice in this monorepo's install graph (hoisted vs.
// nested), and those two copies' structurally-similar types aren't
// nominally assignable to each other.
type MonacoEditorInstance = Parameters<OnMount>[0];

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function SQLEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Write your SQL query here...",
}: SQLEditorProps) {
  const editorRef = useRef<MonacoEditorInstance | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure SQL language
    monaco.languages.setMonarchTokensProvider("sql", {
      tokenizer: {
        root: [
          [
            /^(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|DISTINCT|ALL|EXISTS|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|AS|GROUP|BY|HAVING|ORDER|ASC|DESC|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|FROM|CREATE|TABLE|INDEX|DROP|ALTER|ADD|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CHECK|DEFAULT|AUTO_INCREMENT|INT|INTEGER|SMALLINT|BIGINT|DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE|CHAR|VARCHAR|TEXT|DATE|TIME|DATETIME|TIMESTAMP|BOOLEAN|BOOL)\b/i,
            "keyword",
          ],
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

    // Set up SQL language features
    monaco.languages.register({ id: "sql" });

    // Configure editor options for SQL
    editor.updateOptions({
      wordBasedSuggestions: "off",
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
    });

    // Add SQL-specific actions
    editor.addAction({
      id: "execute-sql",
      label: "Execute SQL",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        // This will be handled by the parent component
        const event = new CustomEvent("execute-sql");
        window.dispatchEvent(event);
      },
    });

    // Handle placeholder
    if (!value && placeholder) {
      editor.setValue("");
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

    // Focus editor when enabled
    if (!disabled) {
      editor.focus();
    }
  };

  const handleChange = (value: string | undefined) => {
    onChange(value || "");
  };

  // Handle editor resize
  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="sql-editor-wrapper">
      <Editor
        height="100%"
        language="sql"
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme="vs"
        options={{
          selectOnLineNumbers: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily:
            "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace",
          lineNumbers: "on",
          renderLineHighlight: "line",
          automaticLayout: true,
          wordWrap: "on",
          lineNumbersMinChars: 3,
          padding: { top: 16, bottom: 16 },
          readOnly: disabled,
          domReadOnly: disabled,
          contextmenu: !disabled,
          quickSuggestions: !disabled,
          suggestOnTriggerCharacters: !disabled,
          parameterHints: { enabled: !disabled },
          folding: !disabled,
          renderWhitespace: "selection",
          guides: {
            indentation: false,
            bracketPairs: false,
            highlightActiveIndentation: false,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
        }}
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
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          overflow: hidden;
        }

        :global(.monaco-editor:focus-within) {
          outline: none;
          border-color: #0066ff;
          box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.1);
        }

        :global(.monaco-editor.disabled) {
          background-color: #f8f8f8;
          color: #a3a3a3;
          cursor: not-allowed;
        }

        /* Override Monaco colors for light theme */
        :global(.monaco-editor.vs) {
          background-color: #ffffff;
          color: #0a0a0a;
        }

        :global(.monaco-editor.vs .monaco-editor-background) {
          background-color: #ffffff;
        }

        :global(.monaco-editor.vs .margin) {
          background-color: #ffffff;
        }

        :global(.monaco-editor.vs .current-line) {
          background-color: #fafafa;
          border: 1px solid #f0f0f0;
          border-width: 1px 0;
        }

        :global(.monaco-editor.vs .line-numbers) {
          color: #737373;
        }

        :global(.monaco-editor.vs .cursor) {
          background-color: #0a0a0a;
        }

        /* SQL syntax highlighting */
        :global(.monaco-editor.vs .keyword) {
          color: #0066ff;
          font-weight: 600;
        }

        :global(.monaco-editor.vs .string) {
          color: #00a878;
        }

        :global(.monaco-editor.vs .number) {
          color: #ff8800;
        }

        :global(.monaco-editor.vs .comment) {
          color: #737373;
          font-style: italic;
        }

        :global(.monaco-editor.vs .identifier) {
          color: #0a0a0a;
        }

        :global(.monaco-editor.vs .operator) {
          color: #525252;
        }

        :global(.monaco-editor.vs .delimiter) {
          color: #525252;
        }

        /* Selection and highlight */
        :global(.monaco-editor.vs .selected-text) {
          background-color: rgba(0, 102, 255, 0.2);
        }

        :global(.monaco-editor.vs .selection-highlight) {
          background-color: rgba(0, 102, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
