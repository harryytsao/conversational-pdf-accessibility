"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

import Link from "next/link";
import { it } from "node:test";

interface TextItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
}

interface PageData {
  pageNumber: number;
  text: string;
  textLength: number;
  items: TextItem[];
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
  type: "heading" | "paragraph" | "text";
  text: string;
  level?: number; // for headings: 1, 2, 3
  fontSize?: number;
  pageNumber: number;
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

      // Group items into semantic units
      let currentText = "";
      let currentFontSize = 0;

      sortedItems.forEach((item, index) => {
        const text = item.text.trim();
        if (!text) return;

        // Check if this item is a heading
        if (item.fontSize > data.body_font_size && text.length > 3) {
          // Save previous paragraph if exists
          if (currentText) {
            content.push({
              type: "paragraph",
              text: currentText.trim(),
              pageNumber: page.pageNumber,
            });
            currentText = "";
          }

          // Determine heading level
          const level = determineHeadingLevel(
            item,
            data.body_font_size,
            data.maxFontSize
          );
          content.push({
            type: "heading",
            text: text,
            level: level,
            fontSize: item.fontSize,
            pageNumber: page.pageNumber,
          });
        } else {
          // Regular text - accumulate into paragraphs
          currentText += (currentText ? " " : "") + text;
          currentFontSize = item.fontSize;

          // End paragraph on line break or significant gap
          const nextItem = sortedItems[index + 1];
          if (!nextItem || Math.abs(nextItem.y - item.y) > 15) {
            if (currentText.trim()) {
              content.push({
                type: "paragraph",
                text: currentText.trim(),
                pageNumber: page.pageNumber,
              });
              currentText = "";
            }
          }
        }
      });

      // Add any remaining text
      if (currentText.trim()) {
        content.push({
          type: "paragraph",
          text: currentText.trim(),
          pageNumber: page.pageNumber,
        });
      }
    });

    return content;
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

  // Get content for current page
  const pageContent = structuredContent.filter(
    (item) => item.pageNumber === currentPage
  );
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
            <button
              onClick={() => setShowOutline(!show_outline)}
              className="px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm text-black"
              aria-expanded={show_outline}
              aria-controls="outline-panel"
            >
              {show_outline ? "Hide Outline" : "Show Outline"}
            </button>
            <div className="flex items-center gap-4">
              {/* Page navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-black"
                  aria-label="Previous page"
                >
                  ←
                </button>
                <span className="text-sm text-black">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-black"
                  aria-label="Next page"
                >
                  →
                </button>
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
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
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
                    .map((item, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setCurrentPage(item.pageNumber);
                          setShowOutline(!show_outline);
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
                        {item.text.substring(0, 50)}
                        {item.text.length > 50 ? "..." : ""}
                      </button>
                    ))}
                </nav>
              </div>
            </aside>
          )}

          {/* Main Reading Canvas */}
          <article className="col-span-9" role="document">
            <div
              className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px]"
              role="region"
              aria-label={`Page ${currentPage} content`}
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
              ) : pageContent.length > 0 ? (
                <div className="prose prose-lg max-w-none">
                  {pageContent.map((item, index) => {
                    if (item.type === "heading") {
                      // Render appropriate heading based on level
                      if (item.level === 1) {
                        return (
                          <h1
                            key={index}
                            className="text-3xl font-bold mt-0 mb-4 text-black"
                          >
                            {item.text}
                          </h1>
                        );
                      } else if (item.level === 2) {
                        return (
                          <h2
                            key={index}
                            className="text-2xl text-black font-semibold mt-6 mb-3"
                          >
                            {item.text}
                          </h2>
                        );
                      } else {
                        return (
                          <h3
                            key={index}
                            className="text-xl text-black font-semibold mt-4 mb-2"
                          >
                            {item.text}
                          </h3>
                        );
                      }
                    } else {
                      return (
                        <p
                          key={index}
                          className="mb-4 text-black leading-relaxed"
                        >
                          {item.text}
                        </p>
                      );
                    }
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No content available for this page</p>
                </div>
              )}
            </div>

            {/* Page Navigation Footer */}
            <div className="flex justify-between items-center mt-6 text-black">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-black"
              >
                ← Previous Page
              </button>
              <span className="text-sm text-black">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => {
                  const input = prompt(
                    `Enter a page number from 1 to ${totalPages}.`
                  );
                  if (input) {
                    const page_num = parseInt(input, 10);
                    if (
                      !isNaN(page_num) &&
                      page_num >= 1 &&
                      page_num <= totalPages
                    )
                      setCurrentPage(page_num);
                    else alert("Invalid page number.");
                  }
                }}
              >
                Enter Page Number
              </button>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-black"
              >
                Next Page →
              </button>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
