"use client";

import { useState } from "react";

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

interface TableHeaderEditorProps {
  table: Table;
  onSave: (updatedTable: Table) => void;
  onClose: () => void;
}

export default function TableHeaderEditor({
  table,
  onSave,
  onClose,
}: TableHeaderEditorProps) {
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [headerColumnIndices, setHeaderColumnIndices] = useState<number[]>([0]);
  const [customHeaders, setCustomHeaders] = useState<string[]>([]);

  const handleSetHeaderRow = (rowIndex: number) => {
    setHeaderRowIndex(rowIndex);
    // Pre-populate custom headers with that row's text
    if (table.rows[rowIndex]) {
      setCustomHeaders(table.rows[rowIndex].cells.map((cell) => cell.text));
    }
  };

  const handleSave = () => {
    // Create updated table with header metadata
    const updatedTable = {
      ...table,
      headerRow: headerRowIndex,
      headerColumns: headerColumnIndices,
      customHeaders: customHeaders.length > 0 ? customHeaders : undefined,
    };
    onSave(updatedTable as Table);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-black">
            Table Header Configuration
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
          {/* Header Row Selection */}
          <div>
            <label className="block font-semibold mb-2 text-black">
              Which row contains headers?
            </label>
            <select
              value={headerRowIndex}
              onChange={(e) => handleSetHeaderRow(parseInt(e.target.value))}
              className="w-full border rounded px-3 py-2 text-black"
              aria-label="Select header row"
            >
              {table.rows.map((_, index) => (
                <option key={index} value={index}>
                  Row {index + 1}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Header Names */}
          <div>
            <label className="block font-semibold mb-2 text-black">
              Custom Header Names (optional)
            </label>
            {table.rows[headerRowIndex]?.cells.map((cell, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-600 w-20">
                  Column {index + 1}:
                </span>
                <input
                  type="text"
                  value={customHeaders[index] || cell.text}
                  onChange={(e) => {
                    const newHeaders = [...customHeaders];
                    newHeaders[index] = e.target.value;
                    setCustomHeaders(newHeaders);
                  }}
                  className="flex-1 border rounded px-3 py-2 text-black"
                  placeholder={cell.text}
                />
              </div>
            ))}
          </div>

          {/* Table Preview */}
          <div>
            <label className="block font-semibold mb-2 text-black">
              Table Preview
            </label>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-blue-100">
                    {table.rows[headerRowIndex]?.cells
                      .filter((cell) => cell.text.trim().length > 0)
                      .map((cell, index) => (
                        <th
                          key={index}
                          className="px-4 py-2 border text-left font-bold text-black"
                        >
                          {customHeaders[index] || cell.text}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows
                    .filter((_, index) => index !== headerRowIndex)
                    .slice(0, 5)
                    .map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={
                          rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }
                      >
                        {row.cells
                          .filter((cell) => cell.text.trim().length > 0)
                          .map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-4 py-2 border text-black"
                            >
                              {cell.text}
                            </td>
                          ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {table.rows.length > 6 && (
              <p className="text-sm text-gray-600 mt-2">
                Showing first 5 data rows
              </p>
            )}
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Header Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
