"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  provenance?: {
    pageNumber: number;
    type: "table" | "figure" | "text" | "equation";
    excerpt?: string;
  }[];
  timestamp: Date;
}

interface GroundedQAProps {
  documentData: any;
  onNavigateToPage: (pageNumber: number) => void;
}

export default function GroundedQA({
  documentData,
  onNavigateToPage,
}: GroundedQAProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I can answer questions about this document based on its extracted content. Try asking about tables, figures, or specific sections.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Simple grounded Q&A logic (would use LLM in production)
  const answerQuestion = (question: string): Message => {
    const q = question.toLowerCase();
    const provenance: Message["provenance"] = [];
    let answer = "";

    // Check for table questions
    if (q.includes("table") || q.includes("column")) {
      const pagesWithTables = documentData.pages.filter(
        (p: any) => p.hasTable && p.table
      );

      if (pagesWithTables.length > 0) {
        const firstTable = pagesWithTables[0];

        if (q.includes("column") && q.includes("header")) {
          // Extract column headers
          if (firstTable.table && firstTable.table.rows.length > 0) {
            const headers = firstTable.table.rows[0].cells
              .filter((c: any) => c.text.trim())
              .map((c: any) => c.text);
            answer = `The table on page ${
              firstTable.pageNumber
            } has the following column headers: ${headers.join(", ")}.`;
            provenance.push({
              pageNumber: firstTable.pageNumber,
              type: "table",
              excerpt: headers.join(" | "),
            });
          }
        } else {
          answer = `I found ${pagesWithTables.length} table(s) in the document. The first one is on page ${firstTable.pageNumber}.`;
          provenance.push({
            pageNumber: firstTable.pageNumber,
            type: "table",
          });
        }
      } else {
        answer = "I couldn't find any tables in this document.";
      }
    }
    // Check for figure questions
    else if (
      q.includes("figure") ||
      q.includes("image") ||
      q.includes("diagram")
    ) {
      const pagesWithFigures = documentData.pages.filter(
        (p: any) => p.figures && p.figures.length > 0
      );

      if (pagesWithFigures.length > 0) {
        const allFigures = pagesWithFigures.flatMap((p: any) =>
          p.figures.map((f: any) => ({ ...f, pageNumber: p.pageNumber }))
        );

        // Check if asking about specific figure
        const figureMatch = q.match(/figure\s+(\d+)/i);
        if (figureMatch) {
          const figNum = figureMatch[1];
          const figure = allFigures.find((f: any) => f.number === figNum);
          if (figure) {
            answer = `${figure.label}: ${figure.caption}. ${
              figure.altText || "(No description provided yet)"
            }`;
            provenance.push({
              pageNumber: figure.pageNumber,
              type: "figure",
              excerpt: figure.caption,
            });
          } else {
            answer = `Figure ${figNum} was not found in the document.`;
          }
        } else {
          answer = `I found ${
            allFigures.length
          } figure(s) in this document: ${allFigures
            .map((f: any) => `${f.label} on page ${f.pageNumber}`)
            .join(", ")}.`;
          allFigures.forEach((f: any) => {
            provenance.push({
              pageNumber: f.pageNumber,
              type: "figure",
              excerpt: f.caption,
            });
          });
        }
      } else {
        answer = "I couldn't find any figures in this document.";
      }
    }
    // Check for equation questions
    else if (
      q.includes("equation") ||
      q.includes("formula") ||
      q.includes("math")
    ) {
      const pagesWithEquations = documentData.pages.filter(
        (p: any) => p.equations && p.equations.length > 0
      );

      if (pagesWithEquations.length > 0) {
        const totalEquations = pagesWithEquations.reduce(
          (sum: number, p: any) => sum + p.equations.length,
          0
        );
        answer = `I found ${totalEquations} equation(s) in the document, appearing on ${pagesWithEquations.length} page(s).`;

        pagesWithEquations.slice(0, 3).forEach((p: any) => {
          provenance.push({
            pageNumber: p.pageNumber,
            type: "equation",
            excerpt: p.equations[0].text,
          });
        });
      } else {
        answer = "I couldn't find any mathematical equations in this document.";
      }
    }
    // General content search
    else {
      // Search in text content
      const matchingPages = documentData.pages.filter((p: any) =>
        p.text
          .toLowerCase()
          .includes(q.replace(/what|where|when|how|why/gi, "").trim())
      );

      if (matchingPages.length > 0) {
        answer = `I found relevant content on ${
          matchingPages.length
        } page(s): ${matchingPages
          .slice(0, 3)
          .map((p: any) => `page ${p.pageNumber}`)
          .join(", ")}.`;

        matchingPages.slice(0, 3).forEach((p: any) => {
          const excerpt = p.text.substring(0, 100) + "...";
          provenance.push({
            pageNumber: p.pageNumber,
            type: "text",
            excerpt,
          });
        });
      } else {
        answer =
          "I couldn't find specific information about that in the document. Try asking about tables, figures, or specific sections.";
      }
    }

    return {
      role: "assistant",
      content: answer,
      provenance: provenance.length > 0 ? provenance : undefined,
      timestamp: new Date(),
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate processing delay
    setTimeout(() => {
      const assistantMessage = answerQuestion(input);
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="flex flex-col bg-white rounded-lg border shadow-sm h-[calc(100vh-200px)] max-h-[800px]">
      {/* Header */}
      <div
        className="text-white px-4 py-2 rounded-t-lg flex-shrink-0"
        style={{ backgroundColor: "#082f49" }}
      >
        <h3 className="font-semibold text-base">Document Q&A</h3>
        <p className="text-xs opacity-80">
          Ask questions about tables, figures, and content
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-black"
              }`}
            >
              <div className="text-sm leading-relaxed">{message.content}</div>

              {/* Provenance */}
              {message.provenance && message.provenance.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300">
                  <div className="text-xs font-semibold mb-1">Sources:</div>
                  {message.provenance.map((prov, provIndex) => (
                    <button
                      key={provIndex}
                      onClick={() => onNavigateToPage(prov.pageNumber)}
                      className="block text-xs text-left hover:underline mb-1 text-blue-700 w-full"
                    >
                      📄 Page {prov.pageNumber} ({prov.type})
                      {prov.excerpt && (
                        <span className="block text-gray-600 italic text-xs">
                          "{prov.excerpt.substring(0, 40)}..."
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="text-[10px] opacity-60 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2 text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t p-3 bg-gray-50 rounded-b-lg flex-shrink-0"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about tables or figures..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": "#082f49" } as React.CSSProperties}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            style={{ backgroundColor: "#082f49" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#0a3a5c")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#082f49")
            }
          >
            Send
          </button>
        </div>
        <div className="mt-1.5 text-xs text-gray-500 leading-tight">
          Try: "List column headers" or "What does Figure 2 show?"
        </div>
      </form>
    </div>
  );
}
