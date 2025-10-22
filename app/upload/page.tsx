"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function UploadPage() {
  const [status, setStatus] = useState<string>("");
  const [file_name, setFileName] = useState<string | null>(null);
  const [meta_data, setMetaData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  //handle file selection
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setIsProcessing(true);
    setStatus("Uploading file to server. Please wait.");
    const form_data = new FormData();
    form_data.append("file", file);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: form_data,
      });
      const data = await response.json();
      if (response.ok) {
        setFileName(data.file_name);
        setStatus(
          `Upload successful! File name: ${file.name}. Now analyzing PDF content. This may take a moment.`
        );
      } else {
        setStatus(`Upload failed. Error: ${data.error}. Please try again.`);
        setIsProcessing(false);
        return;
      }
      const analyze_response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: data.file_name }),
      });
      const analyze_data = await analyze_response.json();
      if (!analyze_response.ok) {
        setStatus(
          `Analysis failed. Error: ${analyze_data.error}. Please try uploading again.`
        );
        setIsProcessing(false);
        return;
      }
      setMetaData(analyze_data);
      setStatus(
        `Success! Analysis complete for ${file.name}. Document has ${analyze_data.page_count} pages. Ready to read.`
      );
      setIsProcessing(false);
    } catch (err: any) {
      setStatus(`Upload failed. Error: ${err.message}. Please try again.`);
      setIsProcessing(false);
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [] },
    multiple: false,
    disabled: isProcessing,
  });
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
      {/* App Header */}
      <header className="text-center mb-8 max-w-3xl">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          PDF Accessibility Reader
        </h1>
        <p className="text-xl text-gray-800 mb-2">
          Upload a PDF and get an accessible, screen reader-friendly version
        </p>
        <p className="text-lg text-gray-700">
          We automatically detect headings, structure content, and provide easy
          navigation
        </p>
      </header>

      {/* Upload Area */}
      <section aria-labelledby="upload-heading" className="w-full max-w-2xl">
        <h2 id="upload-heading" className="sr-only">
          Upload your PDF file
        </h2>
        <div
          {...getRootProps({
            className:
              "border-4 border-dashed rounded-xl p-12 w-full text-center cursor-pointer transition-all " +
              (isProcessing
                ? "bg-gray-200 border-gray-400 cursor-not-allowed"
                : isDragActive
                ? "bg-blue-50 border-blue-600 shadow-lg"
                : "bg-white border-gray-400 hover:border-blue-500 hover:bg-blue-50 focus-within:ring-4 focus-within:ring-blue-300 focus-within:border-blue-600"),
            role: "button",
            tabIndex: isProcessing ? -1 : 0,
            "aria-label": isProcessing
              ? "File upload in progress. Please wait."
              : "Upload PDF file. Press Enter or Space to browse for a file, or drag and drop a PDF file here.",
            "aria-disabled": isProcessing,
          })}
        >
          <input {...getInputProps()} aria-describedby="upload-instructions" />
          <div id="upload-instructions">
            {isProcessing ? (
              <>
                <p className="text-2xl font-semibold mb-2 text-gray-700">
                  Processing...
                </p>
                <p className="text-lg text-gray-600">
                  Please wait while we process your file
                </p>
              </>
            ) : isDragActive ? (
              <>
                <p className="text-2xl font-semibold mb-2 text-blue-700">
                  Release to upload
                </p>
                <p className="text-lg text-blue-600">Drop your PDF file here</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold mb-3 text-gray-900">
                  Upload a PDF File
                </p>
                <p className="text-lg text-gray-700 mb-2">
                  Press Enter or Space to select a file from your computer
                </p>
                <p className="text-lg text-gray-700">
                  Or drag and drop a PDF file here
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Status Messages */}
      {status && (
        <div
          className="mt-6 p-6 bg-white border-2 border-gray-300 rounded-lg max-w-2xl w-full"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="text-lg font-semibold text-gray-900">{status}</p>
        </div>
      )}
      {meta_data && (
        <div className="border rounded-xl p-6 w-full max-w-2xl text-left bg-gray-50 mt-6 text-black">
          <h2 className="text-xl font-bold mb-4">Analysis Complete</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Title</p>
              <p className="font-semibold">{meta_data.title}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Author</p>
              <p className="font-semibold">{meta_data.author}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pages</p>
              <p className="font-semibold">{meta_data.page_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Text Extracted</p>
              <p className="font-semibold">
                {meta_data.textLength?.toLocaleString()} characters
              </p>
            </div>
          </div>

          <div className="border-t pt-4 mb-4">
            <h3 className="font-semibold mb-2">Document Analysis</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-sm font-medium ${
                    meta_data.isScanned
                      ? "bg-orange-100 text-orange-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {meta_data.isScanned ? "⚠️ Scanned PDF" : "✓ Native PDF"}
                </span>
                <span className="text-sm text-gray-600">
                  {meta_data.isScanned
                    ? "Needs OCR/Vision processing"
                    : "Text extraction successful"}
                </span>
              </div>

              {!meta_data.isScanned && (
                <>
                  <p className="text-sm">
                    <strong>Font Sizes:</strong> Body font{" "}
                    {meta_data.body_font_size}, Max {meta_data.maxFontSize} (for
                    heading detection)
                  </p>
                  <p className="text-sm">
                    <strong>Total Text Items:</strong>{" "}
                    {meta_data.pages
                      ?.reduce((sum: number, p: any) => sum + p.itemCount, 0)
                      .toLocaleString()}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="border-t pt-4 mb-4">
            <h3 className="font-semibold mb-2">Per-Page Breakdown</h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {meta_data.pages?.map((page: any) => (
                <div
                  key={page.pageNumber}
                  className="text-sm bg-white p-2 rounded border"
                >
                  <strong>Page {page.pageNumber}:</strong> {page.textLength}{" "}
                  chars, {page.itemCount} items
                  {page.text && (
                    <p className="text-gray-600 text-xs mt-1 truncate">
                      "{page.text.substring(0, 100)}..."
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => router.push(`/reader?file=${meta_data.file_name}`)}
            className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
          >
            Continue to Reader →
          </button>
        </div>
      )}
    </main>
  );
}
