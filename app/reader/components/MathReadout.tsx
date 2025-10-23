"use client";

import { useState } from "react";

interface Equation {
  type: "equation";
  text: string;
  items: any[];
  y: number;
}

interface MathReadoutProps {
  equation: Equation;
  equationIndex: number;
}

export default function MathReadout({
  equation,
  equationIndex,
}: MathReadoutProps) {
  const [expanded, setExpanded] = useState(false);
  const [readingMode, setReadingMode] = useState<"normal" | "token">("normal");

  // Parse equation text to identify components
  const parseEquationTokens = (text: string): string[] => {
    // Simple tokenization - would be more sophisticated in production
    const tokens: string[] = [];
    let current = "";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Math operators and symbols
      if (/[+\-*/=()[\]{}^_,]/.test(char)) {
        if (current) tokens.push(current);
        tokens.push(char);
        current = "";
      }
      // Numbers and variables
      else if (char === " ") {
        if (current) tokens.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    if (current) tokens.push(current);
    return tokens;
  };

  const tokens = parseEquationTokens(equation.text);

  // Convert token to speech-friendly text
  const tokenToSpeech = (token: string): string => {
    const speechMap: { [key: string]: string } = {
      "+": "plus",
      "-": "minus",
      "*": "times",
      "/": "divided by",
      "=": "equals",
      "^": "to the power of",
      _: "subscript",
      "(": "open parenthesis",
      ")": "close parenthesis",
      "[": "open bracket",
      "]": "close bracket",
      "{": "open brace",
      "}": "close brace",
      "∑": "sum",
      "∫": "integral",
      "∂": "partial derivative",
      "√": "square root",
      "∞": "infinity",
      "≈": "approximately equals",
      "≠": "not equal to",
      "≤": "less than or equal to",
      "≥": "greater than or equal to",
      "±": "plus or minus",
      "×": "times",
      "÷": "divided by",
    };

    return speechMap[token] || token;
  };

  // Generate basic MathML (simplified)
  const generateMathML = (text: string): string => {
    return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
      <mrow>
        ${tokens
          .map((token) => {
            if (/^[a-zA-Z]$/.test(token)) {
              return `<mi>${token}</mi>`;
            } else if (/^\d+$/.test(token)) {
              return `<mn>${token}</mn>`;
            } else if (/[+\-*/=]/.test(token)) {
              return `<mo>${token}</mo>`;
            } else {
              return `<mtext>${token}</mtext>`;
            }
          })
          .join("\n        ")}
      </mrow>
    </math>`;
  };

  return (
    <div className="border-2 border-purple-300 bg-purple-50 rounded-lg p-4 my-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-purple-700 font-semibold">
            📐 Equation {equationIndex + 1}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-purple-600 hover:underline"
            aria-expanded={expanded ? "true" : "false"}
          >
            {expanded ? "Hide Details" : "Show Details"}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setReadingMode("normal")}
            className={`px-3 py-1 rounded text-sm ${
              readingMode === "normal"
                ? "bg-purple-600 text-white"
                : "bg-white text-purple-600 border border-purple-300"
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => setReadingMode("token")}
            className={`px-3 py-1 rounded text-sm ${
              readingMode === "token"
                ? "bg-purple-600 text-white"
                : "bg-white text-purple-600 border border-purple-300"
            }`}
          >
            Token-by-Token
          </button>
        </div>
      </div>

      {/* Equation Display */}
      <div
        className="font-mono text-lg bg-white p-3 rounded border border-purple-200"
        role="math"
        aria-label={`Equation: ${tokens.map(tokenToSpeech).join(" ")}`}
      >
        {equation.text}
      </div>

      {/* Token-by-Token Readout */}
      {readingMode === "token" && (
        <div className="mt-3 space-y-1">
          <div className="text-sm font-semibold text-purple-700">
            Token-by-Token Readout:
          </div>
          <div className="bg-white p-3 rounded border border-purple-200">
            {tokens.map((token, index) => (
              <div key={index} className="flex items-center gap-3 py-1">
                <span className="font-mono text-sm bg-purple-100 px-2 py-1 rounded">
                  {token}
                </span>
                <span className="text-gray-700 text-sm">
                  → {tokenToSpeech(token)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {/* MathML */}
          <div>
            <div className="text-sm font-semibold text-purple-700 mb-1">
              MathML Representation:
            </div>
            <pre className="bg-white p-3 rounded border border-purple-200 text-xs overflow-x-auto">
              {generateMathML(equation.text)}
            </pre>
          </div>

          {/* Speech Output */}
          <div>
            <div className="text-sm font-semibold text-purple-700 mb-1">
              Screen Reader Output:
            </div>
            <div className="bg-white p-3 rounded border border-purple-200 text-sm">
              {tokens.map(tokenToSpeech).join(" ")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
