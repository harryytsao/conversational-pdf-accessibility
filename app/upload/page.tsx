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
                body: form_data
            });
            const data = await response.json();
            if (response.ok) {
                setFileName(data.file_name);
                setStatus("Upload successful!");
            }
            else {
                setStatus(`Upload failed: ${data.error}`);
                return;
        }
        const analyze_response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_name: data.file_name })
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
        multiple: false
    });
    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-6">
            <h1 className="text-2xl font-bold mb-4">Upload a PDF</h1>
            <div {...getRootProps({
                className: "border-2 border-dashed rounded-xl p-10 w-96 text-center cursor-pointer " +
            (isDragActive ? "bg-blue-100 border-blue-500" : "border-gray-400"),
            role: "button",
            tabIndex: 0,
            "aria-label": "Drag and drop a PDF file or press Enter to browse."
            })}>
                <input {...getInputProps()} />
                {isDragActive ? (<p>Drop the file here...</p>) : (
                <p>Drag 'n' drop a PDF file here, or click to select one</p>
                )}
            </div>
            <p className="mt-4" aria-live="polite">{status}</p>
            {meta_data && (
                <div className="border rounded-xl p-4 w-96 text-left bg-gray-50">
                    <h2 className="font-semibold mb-2">PDF Metadata</h2>
                    <p><strong>Title:</strong> {meta_data.title}</p>
                    <p><strong>Author:</strong> {meta_data.author}</p>
                    <p><strong>Pages:</strong> {meta_data.page_count}</p>
                    <button onClick={() => router.push(`/reader?file=${meta_data.file_name}`)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Continue</button>
                </div>)}
        </main>
    );
}
