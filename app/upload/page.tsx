"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function UploadPage() {
  const [status, setStatus] = useState<string>("");
  const [file_name, setFileName] = useState<string | null>(null);
  const [meta_data, setMetaData] = useState<any>(null);
  const router = useRouter();
  //handle file selection
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setStatus("Uploading...");
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
        setStatus("Upload successful! Analyzing PDF...");
      } else {
        setStatus(`Upload failed: ${data.error}`);
        return;
      }
      const analyze_response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: data.file_name }),
      });
      const analyze_data = await analyze_response.json();
      if (!analyze_response.ok) {
        setStatus(`Analysis failed: ${analyze_data.error}`);
        return;
      }
      setMetaData(analyze_data);
      setStatus("Upload and analysis complete!");
    } catch (err: any) {
      setStatus(`❌ Upload failed: ${err.message}`);
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [] },
    multiple: false,
  });
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Upload a PDF</h1>
      <div
        {...getRootProps({
          className:
            "border-2 border-dashed rounded-xl p-10 w-96 text-center cursor-pointer " +
            (isDragActive ? "bg-blue-100 border-blue-500" : "border-gray-400"),
          role: "button",
          tabIndex: 0,
          "aria-label": "Drag and drop a PDF file or press Enter to browse.",
        })}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the file here...</p>
        ) : (
          <p>Drag 'n' drop a PDF file here, or click to select one</p>
        )}
      </div>
      <p className="mt-4" aria-live="polite">
        {status}
      </p>
      {meta_data && (
        <div className="border rounded-xl p-6 w-full max-w-2xl text-left bg-gray-50 mt-6 text-black">
          <h2 className="text-xl font-bold mb-4">✅ Analysis Complete</h2>

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
                    <strong>Font Sizes:</strong> Average {meta_data.avgFontSize}
                    , Max {meta_data.maxFontSize} (for heading detection)
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
