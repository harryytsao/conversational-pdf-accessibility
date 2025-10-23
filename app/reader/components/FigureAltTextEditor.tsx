"use client";

import { useState } from "react";

interface Figure {
  type: "figure";
  label: string;
  number: string;
  caption: string;
  x: number;
  y: number;
  altText: string;
}

interface FigureAltTextEditorProps {
  figure: Figure;
  onSave: (updatedFigure: Figure) => void;
  onClose: () => void;
}

export default function FigureAltTextEditor({
  figure,
  onSave,
  onClose,
}: FigureAltTextEditorProps) {
  const [altText, setAltText] = useState(figure.altText || "");
  const [useAI, setUseAI] = useState(false);

  const handleGenerateAI = async () => {
    setUseAI(true);
    // Placeholder for AI generation - would call vision API
    const draftAltText = `Draft description for ${figure.label}: This figure shows ${figure.caption}. [AI-generated description would provide more visual detail here.]`;
    setAltText(draftAltText);
    setUseAI(false);
  };

  const handleSave = () => {
    onSave({
      ...figure,
      altText: altText.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-black">
            Edit Figure Description
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close editor"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Figure Info */}
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <div className="font-semibold text-lg text-black">
              {figure.label}
            </div>
            <div className="text-sm text-gray-700 mt-1">
              <strong>Caption:</strong> {figure.caption}
            </div>
          </div>

          {/* AI Generation */}
          <div>
            <button
              onClick={handleGenerateAI}
              disabled={useAI}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {useAI
                ? "Generating with AI..."
                : "🤖 Generate Description with AI"}
            </button>
            <p className="text-xs text-gray-600 mt-1">
              Uses vision model to describe visual content
            </p>
          </div>

          {/* Alt Text Editor */}
          <div>
            <label className="block font-semibold mb-2 text-black">
              Alternative Text Description
            </label>
            <textarea
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="w-full border rounded px-3 py-2 text-black min-h-[150px]"
              placeholder="Describe what this figure shows. Be specific about visual elements, data trends, or important details that would help a blind or low-vision reader understand the figure's content and purpose."
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>{altText.length} characters</span>
              <span>
                Recommended: 50-250 characters for simple figures, more for
                complex ones
              </span>
            </div>
          </div>

          {/* Guidelines */}
          <div className="bg-gray-50 p-3 rounded text-sm">
            <strong className="text-black">Guidelines:</strong>
            <ul className="mt-2 space-y-1 text-gray-700 list-disc list-inside">
              <li>Start with the figure type (e.g., "Bar chart showing...")</li>
              <li>Describe key visual elements and trends</li>
              <li>Include important data points or comparisons</li>
              <li>Keep it concise but informative</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-100 text-black"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!altText.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Description
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
