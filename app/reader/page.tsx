"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

import Link from "next/link";
import TableHeaderEditor from "./components/TableHeaderEditor";
import FigureAltTextEditor from "./components/FigureAltTextEditor";
import MathReadout from "./components/MathReadout";
import GroundedQA from "./components/GroundedQA";

interface TextItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
  width?: number;
  height?: number;
}

interface TableCell {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

interface TableRow {
  cells: TableCell[];
}

interface Table {
  type: "table";
  rows: TableRow[];
}

interface Figure {
  type: "figure";
  label: string;
  number: string;
  caption: string;
  x: number;
  y: number;
  altText: string;
}

interface Equation {
  type: "equation";
  text: string;
  items: TextItem[];
  y: number;
}

interface PageData {
  pageNumber: number;
  text: string;
  textLength: number;
  items: TextItem[];
  width?: number;
  height?: number;
  columns?: number;
  hasTable?: boolean;
  table?: Table | null;
  figures?: Figure[];
  equations?: Equation[];
  structures?: any[];
}

interface DocumentData {
  file_name: string;
  title: string;
  author: string;
  page_count: number;
  isScanned: boolean;
  textLength: number;
  body_font_size: number;
  maxFontSize: number;
  pages: PageData[];
}

interface StructuredContent {
  type: "heading" | "paragraph" | "text" | "table" | "figure" | "equation";
  text?: string;
  level?: number; // for headings: 1, 2, 3
  fontSize?: number;
  pageNumber: number;
  table?: Table;
  figure?: Figure;
  equation?: Equation;
  equationIndex?: number;
}

//Function to create a scoring system to determine heading levels
function determineHeadingLevel(
  item: TextItem,
  body_font_threshold: number,
  page_width = 600
) {
  const ratio = item.fontSize / body_font_threshold;
  const text = item.text.trim();
  let score = 0;
  let level = 0;
  // Font size contribution is the main driver of level
  if (ratio >= 1.8) level = 1;
  else if (ratio >= 1.4) level = 2;
  else if (ratio >= 1.1) level = 3;
  else level = 0;
  //Use score to refine level
  //style contribution
  const font = item.fontName.toLowerCase();
  if (font.includes("bold") || font.includes("black") || font.includes("heavy"))
    score += 1;
  if (text === text.toUpperCase() && text.length > 3) score += 1;
  //Layout contribution
  const text_center = item.x + text.length * item.fontSize * 0.5;
  const page_center = page_width / 2;
  if (Math.abs(text_center - page_center) < page_width * 0.1) score += 1;
  //text length contribution
  if (text.length < 60) score += 1;
  if (score >= 2 && level == 0) level = 3;
  if (text.length > 120) return 0;
  //Determine level based on score
  return level;
}

export default function ReaderPage() {
  const searchParams = useSearchParams();
  const fileName = searchParams.get("file");

  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [structuredContent, setStructuredContent] = useState<
    StructuredContent[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [show_outline, setShowOutline] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [editingFigure, setEditingFigure] = useState<Figure | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef<Map<string, HTMLElement>>(new Map());
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Update current page indicator based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (!mainContentRef.current) return;

      const scrollPosition = mainContentRef.current.scrollTop;
      const pageElements = Array.from(
        mainContentRef.current.querySelectorAll("[data-page-number]")
      );

      for (let i = pageElements.length - 1; i >= 0; i--) {
        const element = pageElements[i] as HTMLElement;
        const elementTop = element.offsetTop - mainContentRef.current.offsetTop;

        if (scrollPosition >= elementTop - 100) {
          const pageNum = parseInt(
            element.getAttribute("data-page-number") || "1",
            10
          );
          setCurrentPage(pageNum);
          break;
        }
      }
    };

    const contentEl = mainContentRef.current;
    if (contentEl) {
      contentEl.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (contentEl) {
        contentEl.removeEventListener("scroll", handleScroll);
      }
    };
  }, [structuredContent]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportMenu]);

  useEffect(() => {
    if (!fileName) {
      setError("No file specified");
      setLoading(false);
      return;
    }

    // Load the extracted JSON data
    fetch(`/api/data/${fileName}.json`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load document data");
        return res.json();
      })
      .then((data: DocumentData) => {
        setDocumentData(data);

        // Process into structured content
        const structured = processDocumentStructure(data);
        setStructuredContent(structured);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [fileName]);

  // Process document into structured semantic content
  const processDocumentStructure = (
    data: DocumentData
  ): StructuredContent[] => {
    const content: StructuredContent[] = [];

    if (data.isScanned) {
      // For scanned PDFs, show message
      content.push({
        type: "paragraph",
        text: "⚠️ This is a scanned PDF. Vision model processing needed for full accessibility.",
        pageNumber: 0,
      });
      return content;
    }

    data.pages.forEach((page) => {
      // Sort items by reading order (top to bottom, left to right)
      const sortedItems = [...page.items].sort((a, b) => {
        // Same line (within 5 units)
        if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
        // Different lines (Y increases downward in PDF coords, so reverse)
        return b.y - a.y;
      });

      // First, group items by line (same Y position)
      const lines: Array<{
        items: TextItem[];
        y: number;
        avgFontSize: number;
        maxFontSize: number;
        text: string;
      }> = [];

      let currentLine: TextItem[] = [];
      let currentY = sortedItems[0]?.y || 0;

      sortedItems.forEach((item, index) => {
        if (!item.text.trim()) return;

        // Check if this item is on the same line as previous (within 5 units)
        if (index === 0 || Math.abs(item.y - currentY) < 5) {
          currentLine.push(item);
        } else {
          // Save previous line
          if (currentLine.length > 0) {
            const avgFontSize =
              currentLine.reduce((sum, i) => sum + i.fontSize, 0) /
              currentLine.length;
            const maxFontSize = Math.max(...currentLine.map((i) => i.fontSize));
            const text = currentLine
              .map((i) => i.text)
              .join(" ")
              .trim();
            lines.push({
              items: currentLine,
              y: currentY,
              avgFontSize,
              maxFontSize,
              text,
            });
          }
          // Start new line
          currentLine = [item];
          currentY = item.y;
        }
      });

      // Don't forget the last line
      if (currentLine.length > 0) {
        const avgFontSize =
          currentLine.reduce((sum, i) => sum + i.fontSize, 0) /
          currentLine.length;
        const maxFontSize = Math.max(...currentLine.map((i) => i.fontSize));
        const text = currentLine
          .map((i) => i.text)
          .join(" ")
          .trim();
        lines.push({
          items: currentLine,
          y: currentY,
          avgFontSize,
          maxFontSize,
          text,
        });
      }

      // Now process lines as semantic units
      let currentParagraph = "";

      lines.forEach((line, index) => {
        // Check if this line is a heading (use max font size from line)
        const isLargeFont = line.maxFontSize > data.body_font_size;
        const hasMinLength = line.text.length >= 3;
        const notTooLong = line.text.length < 120;

        if (isLargeFont && hasMinLength && notTooLong) {
          // This line is a heading - save any previous paragraph
          if (currentParagraph.trim()) {
            content.push({
              type: "paragraph",
              text: currentParagraph.trim(),
              pageNumber: page.pageNumber,
            });
            currentParagraph = "";
          }

          // Determine heading level using the line's max font size
          const representativeItem = line.items.reduce((max, item) =>
            item.fontSize > max.fontSize ? item : max
          );
          const level = determineHeadingLevel(
            representativeItem,
            data.body_font_size,
            page.width || 600
          );

          content.push({
            type: "heading",
            text: line.text,
            level: level,
            fontSize: line.maxFontSize,
            pageNumber: page.pageNumber,
          });
        } else {
          // Regular text - accumulate into paragraphs
          currentParagraph += (currentParagraph ? " " : "") + line.text;

          // End paragraph on significant gap to next line
          const nextLine = lines[index + 1];
          if (
            !nextLine ||
            Math.abs(nextLine.y - line.y) > line.avgFontSize * 2
          ) {
            if (currentParagraph.trim()) {
              content.push({
                type: "paragraph",
                text: currentParagraph.trim(),
                pageNumber: page.pageNumber,
              });
              currentParagraph = "";
            }
          }
        }
      });

      // Add any remaining paragraph text
      if (currentParagraph.trim()) {
        content.push({
          type: "paragraph",
          text: currentParagraph.trim(),
          pageNumber: page.pageNumber,
        });
      }

      // Add table if present (after other content)
      if (page.hasTable && page.table) {
        content.push({
          type: "table",
          pageNumber: page.pageNumber,
          table: page.table,
        });
      }

      // Add figures
      if (page.figures && page.figures.length > 0) {
        page.figures.forEach((figure) => {
          content.push({
            type: "figure",
            pageNumber: page.pageNumber,
            figure: figure,
          });
        });
      }

      // Add equations
      if (page.equations && page.equations.length > 0) {
        page.equations.forEach((equation, index) => {
          content.push({
            type: "equation",
            pageNumber: page.pageNumber,
            equation: equation,
            equationIndex: index,
          });
        });
      }
    });

    return content;
  };

  // Export handlers
  const handleExportHTML = async () => {
    if (!fileName) return;
    setExporting(true);
    try {
      const response = await fetch("/api/export/html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: fileName }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileName.replace(".pdf", "")}-accessible.html`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert("Export failed");
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDFUA = async () => {
    if (!fileName) return;
    setExporting(true);
    try {
      const response = await fetch("/api/export/pdfua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: fileName }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileName.replace(".pdf", "")}-accessible.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert("Export failed");
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleSaveTable = (updatedTable: Table) => {
    // In a real app, this would save to backend
    console.log("Table updated:", updatedTable);
    setEditingTable(null);
    alert("Table headers saved!");
  };

  const handleSaveFigure = (updatedFigure: Figure) => {
    // In a real app, this would save to backend and update the JSON
    console.log("Figure updated:", updatedFigure);
    setEditingFigure(null);
    alert("Figure description saved!");
  };

  const scrollToContent = (index: number) => {
    const key = `content-${index}`;
    const element = contentRefs.current.get(key);
    if (element && mainContentRef.current) {
      const elementTop = element.offsetTop - mainContentRef.current.offsetTop;
      mainContentRef.current.scrollTo({
        top: elementTop - 20,
        behavior: "smooth",
      });
    }
  };

  const scrollToPage = (pageNumber: number) => {
    if (!mainContentRef.current) return;
    const pageElement = mainContentRef.current.querySelector(
      `[data-page-number="${pageNumber}"]`
    );
    if (pageElement && mainContentRef.current) {
      const elementTop =
        (pageElement as HTMLElement).offsetTop -
        mainContentRef.current.offsetTop;
      mainContentRef.current.scrollTo({
        top: elementTop - 20,
        behavior: "smooth",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-black">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !documentData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            Error: {error || "Document not found"}
          </p>
          <Link href="/upload" className="text-blue-600 hover:underline">
            ← Back to Upload
          </Link>
        </div>
      </div>
    );
  }

  const totalPages = documentData.page_count;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/upload"
                className="text-blue-600 hover:underline"
                aria-label="Back to upload page"
              >
                ← Back
              </Link>
              <div>
                <h1 className="text-lg font-bold text-black">
                  {documentData.title}
                </h1>
                <p className="text-sm text-black">by {documentData.author}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOutline(!show_outline)}
                className="px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm text-black"
                aria-expanded={show_outline ? "true" : "false"}
                aria-controls="outline-panel"
              >
                {show_outline ? "Hide Outline" : "Show Outline"}
              </button>
              <button
                onClick={() => setShowQA(!showQA)}
                className={`px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm text-black ${
                  showQA ? "bg-blue-100" : ""
                }`}
              >
                {showQA ? "Hide Q&A" : "Ask Questions"}
              </button>
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exporting}
                  className="px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm text-black disabled:opacity-50"
                >
                  {exporting ? "Exporting..." : "Export ▾"}
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-20">
                    <button
                      onClick={() => {
                        handleExportHTML();
                        setShowExportMenu(false);
                      }}
                      disabled={exporting}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-black rounded-t-lg disabled:opacity-50"
                    >
                      Export as HTML
                    </button>
                    <button
                      onClick={() => {
                        handleExportPDFUA();
                        setShowExportMenu(false);
                      }}
                      disabled={exporting}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-black rounded-b-lg disabled:opacity-50"
                    >
                      Export as PDF/UA
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Page indicator */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-black">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Document Info Bar */}
      <div className="bg-blue-50 border-b border-blue-100">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  documentData.isScanned
                    ? "bg-orange-100 text-orange-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {documentData.isScanned ? "⚠️ Scanned" : "✓ Accessible"}
              </span>
            </div>
            <div className="text-black">
              <strong>{documentData.textLength.toLocaleString()}</strong>{" "}
              characters extracted
            </div>
            <div className="text-black">
              <strong>
                {structuredContent.filter((c) => c.type === "heading").length}
              </strong>{" "}
              headings detected
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div
          className={`grid ${showQA ? "grid-cols-12" : "grid-cols-12"} gap-6`}
        >
          {/* Navigation Sidebar */}
          {show_outline && (
            <aside id="outline-panel" className="col-span-3">
              <div className="bg-white rounded-lg border p-4 sticky top-24">
                <h2 className="font-semibold mb-3 text-sm text-black">
                  Document Outline
                </h2>
                <nav aria-label="Document navigation" className="space-y-1">
                  {structuredContent
                    .filter((item) => item.type === "heading")
                    .map((item, index) => {
                      const contentIndex = structuredContent.indexOf(item);
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            scrollToContent(contentIndex);
                            setShowOutline(false);
                          }}
                          className={`block w-full text-left px-2 py-1 rounded text-sm hover:bg-gray-100 ${
                            item.level === 1
                              ? "font-bold"
                              : item.level === 2
                              ? "font-semibold pl-4"
                              : "pl-6"
                          } ${
                            currentPage === item.pageNumber
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-900"
                          }`}
                        >
                          {item.text?.substring(0, 50) || ""}
                          {(item.text?.length || 0) > 50 ? "..." : ""}
                        </button>
                      );
                    })}
                </nav>
              </div>
            </aside>
          )}

          {/* Main Reading Canvas */}
          <article
            className={showQA ? "col-span-6" : "col-span-9"}
            role="document"
          >
            <div
              ref={mainContentRef}
              className="bg-white rounded-lg border shadow-sm p-8 max-h-[calc(100vh-200px)] overflow-y-auto"
              role="region"
              aria-label="Document content"
            >
              {documentData.isScanned ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h2 className="text-2xl font-bold mb-2">
                    Scanned PDF Detected
                  </h2>
                  <p className="text-black mb-4">
                    This PDF contains scanned images. Vision model processing is
                    needed to extract accessible content.
                  </p>
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Process with Vision Model →
                  </button>
                </div>
              ) : structuredContent.length > 0 ? (
                <div className="prose prose-lg max-w-none">
                  {structuredContent.map((item, index) => {
                    const isFirstItemOnPage =
                      index === 0 ||
                      structuredContent[index - 1].pageNumber !==
                        item.pageNumber;
                    const key = `content-${index}`;

                    return (
                      <div
                        key={index}
                        ref={(el) => {
                          if (el) {
                            contentRefs.current.set(key, el);
                          }
                        }}
                      >
                        {/* Page break marker */}
                        {isFirstItemOnPage && (
                          <div
                            data-page-number={item.pageNumber}
                            className="flex items-center gap-3 mb-6 mt-8 first:mt-0"
                          >
                            <div className="h-px flex-1 bg-gray-300"></div>
                            <span className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-100 rounded">
                              Page {item.pageNumber}
                            </span>
                            <div className="h-px flex-1 bg-gray-300"></div>
                          </div>
                        )}

                        {/* Content rendering */}
                        {item.type === "table" && item.table ? (
                          <div className="my-6 overflow-x-auto">
                            <table className="min-w-full border-collapse border-2 border-gray-400">
                              <tbody>
                                {item.table.rows.map((row, rowIndex) => (
                                  <tr
                                    key={rowIndex}
                                    className="border-b border-gray-400"
                                  >
                                    {row.cells
                                      .filter(
                                        (cell) => cell.text.trim().length > 0
                                      )
                                      .map((cell, cellIndex) => {
                                        const cellText = cell.text.trim();

                                        // Determine if this is a header cell (larger font or bold)
                                        const isHeader =
                                          cell.fontSize > 12 ||
                                          cell.fontName
                                            .toLowerCase()
                                            .includes("bold");
                                        const CellTag = isHeader ? "th" : "td";

                                        return (
                                          <CellTag
                                            key={cellIndex}
                                            className={`px-4 py-3 border border-gray-400 text-left ${
                                              isHeader
                                                ? "bg-blue-50 font-semibold text-gray-900"
                                                : "bg-white text-gray-800"
                                            }`}
                                          >
                                            {cellText}
                                          </CellTag>
                                        );
                                      })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <button
                              onClick={() =>
                                item.table && setEditingTable(item.table)
                              }
                              className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                            >
                              ✏️ Edit Table Headers
                            </button>
                          </div>
                        ) : item.type === "figure" && item.figure ? (
                          <div className="my-6 border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                            <div className="font-semibold text-lg text-blue-900 mb-2">
                              {item.figure.label}
                            </div>
                            <div className="text-sm text-gray-700 mb-2">
                              {item.figure.caption}
                            </div>
                            {item.figure.altText && (
                              <div className="bg-white p-3 rounded border border-blue-300 mb-2">
                                <strong className="text-sm">
                                  Description:
                                </strong>
                                <p className="text-sm text-gray-800 mt-1">
                                  {item.figure.altText}
                                </p>
                              </div>
                            )}
                            <button
                              onClick={() => setEditingFigure(item.figure!)}
                              className="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm"
                            >
                              ✏️ {item.figure.altText ? "Edit" : "Add"}{" "}
                              Description
                            </button>
                          </div>
                        ) : item.type === "equation" && item.equation ? (
                          <MathReadout
                            equation={item.equation}
                            equationIndex={item.equationIndex || 0}
                          />
                        ) : item.type === "heading" ? (
                          item.level === 1 ? (
                            <h1 className="text-3xl font-bold mt-0 mb-4 text-black">
                              {item.text}
                            </h1>
                          ) : item.level === 2 ? (
                            <h2 className="text-2xl text-black font-semibold mt-6 mb-3">
                              {item.text}
                            </h2>
                          ) : (
                            <h3 className="text-xl text-black font-semibold mt-4 mb-2">
                              {item.text}
                            </h3>
                          )
                        ) : (
                          <p className="mb-4 text-black leading-relaxed">
                            {item.text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No content available for this page</p>
                </div>
              )}
            </div>
          </article>

          {/* Q&A Panel */}
          {showQA && (
            <aside className="col-span-3">
              <div className="sticky top-24">
                <GroundedQA
                  documentData={documentData}
                  onNavigateToPage={scrollToPage}
                />
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* Modals */}
      {editingTable && (
        <TableHeaderEditor
          table={editingTable}
          onSave={handleSaveTable}
          onClose={() => setEditingTable(null)}
        />
      )}

      {editingFigure && (
        <FigureAltTextEditor
          figure={editingFigure}
          onSave={handleSaveFigure}
          onClose={() => setEditingFigure(null)}
        />
      )}
    </div>
  );
}
