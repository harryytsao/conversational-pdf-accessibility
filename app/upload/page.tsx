"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function UploadPage() {
    const [status, setStatus] = useState<string>("");
    const [file_name, setFileName] = useState<string | null>(null);
    //handle file selection
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;
        setStatus("Uploading...");
        const form_data = new FormData();
        form_data.append("file", file);
        try {
            const response = await fetch("http://localhost:3000/api/upload", {
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
        }
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
            {file_name && <p className="text-gray-600">File: {file_name}</p>}
        </main>
    );
}
