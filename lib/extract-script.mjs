// Standalone script that runs outside Next.js
import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const filePath = process.argv[2];

if (!filePath) {
  console.error(
    JSON.stringify({ success: false, error: "No file path provided" })
  );
  process.exit(1);
}

// Detect columns by clustering X positions
function detectColumns(items, pageWidth) {
  if (items.length === 0) return [];

  // Get left edge positions for substantial items only
  const substantialItems = items.filter(
    (item) => item.text.trim().length > 3 && item.width > 10
  );

  const xPositions = substantialItems.map((item) => item.x);
  const uniqueX = [...new Set(xPositions)].sort((a, b) => a - b);

  // Cluster X positions (items within 40 units are same column)
  const clusters = [];
  const threshold = 40;

  uniqueX.forEach((x) => {
    const existingCluster = clusters.find(
      (c) => Math.abs(c.center - x) < threshold
    );
    if (existingCluster) {
      existingCluster.positions.push(x);
      existingCluster.count = (existingCluster.count || 0) + 1;
      existingCluster.center =
        existingCluster.positions.reduce((a, b) => a + b) /
        existingCluster.positions.length;
    } else {
      clusters.push({ center: x, positions: [x], count: 1 });
    }
  });

  // Filter out clusters with very few items (likely noise)
  const significantClusters = clusters.filter((c) => c.count >= 3);

  // Sort clusters by X position
  significantClusters.sort((a, b) => a.center - b.center);

  // Define column boundaries
  const columns = significantClusters.map((cluster, index) => {
    const nextCluster = significantClusters[index + 1];
    return {
      startX: cluster.center - 20,
      endX: nextCluster ? (cluster.center + nextCluster.center) / 2 : pageWidth,
      centerX: cluster.center,
    };
  });

  return columns;
}

// Detect if items form a table structure
function detectTable(items) {
  if (items.length < 8) return null;

  // Group items by Y position (rows)
  const rowMap = new Map();
  const yTolerance = 5;

  // Filter out very small or empty items
  const meaningfulItems = items.filter(
    (item) => item.text.trim().length > 0 && item.width > 5 && item.fontSize > 8
  );

  meaningfulItems.forEach((item) => {
    let foundRow = false;
    for (let [yKey, rowItems] of rowMap) {
      if (Math.abs(yKey - item.y) < yTolerance) {
        rowItems.push(item);
        foundRow = true;
        break;
      }
    }
    if (!foundRow) {
      rowMap.set(item.y, [item]);
    }
  });

  // Check if we have multiple rows with exactly 2-3 columns (table pattern)
  const rows = Array.from(rowMap.values());

  // Filter rows to find ones that have 2-3 substantial items (likely table columns)
  const tableRows = rows.filter((row) => {
    const substantialCells = row.filter((item) => item.text.trim().length > 3);
    return substantialCells.length >= 2 && substantialCells.length <= 4;
  });

  // Need at least 5 consistent table rows (increased from 3 to avoid detecting multi-column layouts as tables)
  if (tableRows.length < 5) return null;

  // Check for consistent column structure (X positions should be similar across rows)
  const columnPositions = tableRows.map((row) =>
    row.sort((a, b) => a.x - b.x).map((item) => item.x)
  );

  // If we don't have consistent column counts, not a table
  const columnCounts = columnPositions.map((cols) => cols.length);
  const avgColumnCount =
    columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
  // Require very consistent column counts (all rows must have same number of columns)
  const hasConsistentColumns = columnCounts.every(
    (count) => count === Math.round(avgColumnCount)
  );

  if (!hasConsistentColumns) return null;

  // Additional check: Make sure columns align across rows (not just same count)
  // Calculate average X position for each column
  const numColumns = Math.round(avgColumnCount);
  const columnXAverages = [];
  for (let col = 0; col < numColumns; col++) {
    const xPositions = columnPositions
      .filter((row) => row.length > col)
      .map((row) => row[col]);
    const avgX = xPositions.reduce((a, b) => a + b, 0) / xPositions.length;
    columnXAverages.push(avgX);
  }

  // Check if columns align (X positions within 30 units of average)
  const columnsAlign = columnPositions.every((row) =>
    row.every((x, col) => Math.abs(x - columnXAverages[col]) < 30)
  );

  if (!columnsAlign) return null;

  // This looks like a table - build it properly
  return {
    type: "table",
    rows: tableRows.map((rowItems) => {
      // Sort cells left to right and filter empty ones
      const sortedCells = rowItems
        .filter((item) => item.text.trim().length > 0)
        .sort((a, b) => a.x - b.x);
      return {
        cells: sortedCells.map((item) => ({
          text: item.text,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          fontSize: item.fontSize,
          fontName: item.fontName,
        })),
      };
    }),
  };
}

// Check if item is a bullet point
function isBulletPoint(item) {
  // Empty text with certain fonts, or bullet characters
  const bulletChars = ["•", "◦", "▪", "■", "○", "●", "-", "*"];
  return (
    (item.text.trim() === "" && item.width < 10) ||
    bulletChars.includes(item.text.trim())
  );
}

// Detect figures by looking for "Figure" or "Fig." labels
function detectFigures(items) {
  const figures = [];
  const figurePattern = /^(Figure|Fig\.?|Image|Diagram)\s+(\d+\.?\d*)/i;

  items.forEach((item, index) => {
    const match = item.text.match(figurePattern);
    if (match) {
      // Look ahead for caption text (next few items on similar Y or below)
      let caption = item.text;
      const captionItems = items.slice(index + 1, index + 10);

      for (const nextItem of captionItems) {
        const yDiff = item.y - nextItem.y;
        if (yDiff > -20 && yDiff < 30) {
          caption += " " + nextItem.text;
        } else if (yDiff >= 30) {
          break;
        }
      }

      figures.push({
        type: "figure",
        label: match[0],
        number: match[2],
        caption: caption.trim(),
        x: item.x,
        y: item.y,
        altText: "", // To be filled by user
      });
    }
  });

  return figures;
}

// Detect math equations by looking for math symbols and patterns
function detectMathEquations(items) {
  const equations = [];
  const mathSymbols = /[∑∫∂√∞≈≠≤≥±×÷∈∉⊂⊃∪∩∀∃∇∆λμσπθαβγ]/;
  const mathPatterns =
    /^[a-zA-Z]\s*=\s*|^[xy]\^[0-9]|[₀₁₂₃₄₅₆₇₈₉]|[⁰¹²³⁴⁵⁶⁷⁸⁹]/;

  let currentEquation = [];
  let equationStartY = null;

  items.forEach((item, index) => {
    const hasMathSymbol =
      mathSymbols.test(item.text) || mathPatterns.test(item.text);

    if (hasMathSymbol) {
      if (!equationStartY || Math.abs(item.y - equationStartY) < 10) {
        currentEquation.push(item);
        if (!equationStartY) equationStartY = item.y;
      } else {
        // Save previous equation and start new one
        if (currentEquation.length > 0) {
          equations.push({
            type: "equation",
            text: currentEquation.map((i) => i.text).join(" "),
            items: currentEquation,
            y: equationStartY,
          });
        }
        currentEquation = [item];
        equationStartY = item.y;
      }
    } else if (currentEquation.length > 0) {
      // Check if next item continues the equation
      const yDiff = Math.abs(item.y - equationStartY);
      if (yDiff < 10 && /^[a-zA-Z0-9+\-*/=()[\]{}.,\s]$/.test(item.text)) {
        currentEquation.push(item);
      } else {
        // End equation
        if (currentEquation.length >= 3) {
          equations.push({
            type: "equation",
            text: currentEquation.map((i) => i.text).join(" "),
            items: currentEquation,
            y: equationStartY,
          });
        }
        currentEquation = [];
        equationStartY = null;
      }
    }
  });

  // Add any remaining equation
  if (currentEquation.length >= 3) {
    equations.push({
      type: "equation",
      text: currentEquation.map((i) => i.text).join(" "),
      items: currentEquation,
      y: equationStartY,
    });
  }

  return equations;
}

// Assign items to columns
function assignToColumns(items, columns) {
  if (columns.length <= 1) return items; // Single column, no change needed

  return items.map((item) => {
    const itemCenter = item.x + item.width / 2;
    const column = columns.findIndex(
      (col) => itemCenter >= col.startX && itemCenter <= col.endX
    );
    return { ...item, column: column >= 0 ? column : 0 };
  });
}

// Create proper reading order for multi-column content
function createReadingOrder(items, columns) {
  if (columns.length <= 1) {
    // Single column: read top to bottom
    return items.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
      return b.y - a.y;
    });
  }

  // Multi-column: process column by column, top to bottom
  const itemsWithColumns = assignToColumns(items, columns);

  // Group by column
  const columnGroups = [];
  for (let i = 0; i < columns.length; i++) {
    columnGroups[i] = itemsWithColumns.filter((item) => item.column === i);
  }

  // Sort each column top to bottom
  columnGroups.forEach((group) => {
    group.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) return a.x - b.x;
      return b.y - a.y;
    });
  });

  // Interleave columns by vertical position (read across)
  const result = [];
  const maxLength = Math.max(...columnGroups.map((g) => g.length));

  // Get all unique Y positions across columns
  const allYPositions = new Set();
  itemsWithColumns.forEach((item) => {
    const roundedY = Math.round(item.y / 5) * 5; // Group nearby Y values
    allYPositions.add(roundedY);
  });

  const sortedYPositions = Array.from(allYPositions).sort((a, b) => b - a);

  // For each Y band, collect items from all columns
  sortedYPositions.forEach((yPos) => {
    columnGroups.forEach((group) => {
      const itemsAtY = group.filter(
        (item) => Math.abs(Math.round(item.y / 5) * 5 - yPos) < 2
      );
      result.push(...itemsAtY);
    });
  });

  return result;
}

// Build text with structure preservation
function buildStructuredText(items, columns) {
  let pageText = "";
  let structures = [];

  // Check for table structure first
  const table = detectTable(items);
  if (table) {
    structures.push({
      type: "table",
      startIndex: 0,
      endIndex: items.length,
    });

    // Build table text row by row
    table.rows.forEach((row, rowIndex) => {
      const rowText = row.cells
        .map((cell) => cell.text.trim())
        .filter((t) => t)
        .join(" | ");
      if (rowText) {
        pageText += rowText + "\n";
      }
    });

    return { text: pageText, structures };
  }

  // Otherwise, build text with proper reading order
  const orderedItems = createReadingOrder(items, columns);

  for (let index = 0; index < orderedItems.length; index++) {
    const item = orderedItems[index];

    // Handle bullet points
    if (isBulletPoint(item)) {
      pageText += "\n• ";
      continue;
    }

    if (index === 0) {
      pageText = item.text.trim();
      continue;
    }

    const prev = orderedItems[index - 1];

    // Determine spacing based on position
    const horizontal_gap = item.x - (prev.x + prev.width);
    const vertical_gap = prev.y - item.y;

    // Thresholds
    const same_line = 5;
    const space_threshold = item.fontSize * 0.1;
    const paragraph_threshold = item.fontSize * 2.5;

    const is_paragraph = vertical_gap > paragraph_threshold;
    const is_new_line =
      vertical_gap > same_line && vertical_gap <= paragraph_threshold;
    const has_gap = horizontal_gap > space_threshold;

    // Check for column change
    const column_changed =
      prev.column !== undefined &&
      item.column !== undefined &&
      prev.column !== item.column;

    // Text joining rules
    if (column_changed) {
      pageText += "\n\n" + item.text.trimStart();
    } else if (is_paragraph) {
      pageText += "\n\n" + item.text.trimStart();
    } else if (is_new_line) {
      pageText += "\n" + item.text.trimStart();
    } else if (has_gap) {
      pageText += " " + item.text.trimStart();
    } else {
      pageText += item.text;
    }
  }

  return { text: pageText, structures };
}

async function extract() {
  try {
    const buffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(buffer);

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: false,
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    const pages = [];
    let totalTextLength = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;

      const items = textContent.items
        .filter(
          (item) => item.str !== undefined && item.transform !== undefined
        )
        .map((item) => {
          const transform = item.transform;
          return {
            text: item.str,
            x: Math.round(transform[4] * 10) / 10,
            y: Math.round(transform[5] * 10) / 10,
            width: Math.round((item.width || 0) * 10) / 10,
            height: Math.round((item.height || 0) * 10) / 10,
            fontSize: Math.round(Math.abs(transform[0]) * 10) / 10,
            fontName: item.fontName || "unknown",
          };
        });

      // Detect columns
      const columns = detectColumns(items, pageWidth);

      // Detect table structure
      const table = detectTable(items);

      // Detect figures
      const figures = detectFigures(items);

      // Detect math equations
      const equations = detectMathEquations(items);

      // Build structured text
      const { text: pageText, structures } = buildStructuredText(
        items,
        columns
      );

      totalTextLength += pageText.length;

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        textLength: pageText.length,
        width: pageWidth,
        height: pageHeight,
        columns: columns.length,
        hasTable: table !== null,
        table: table,
        figures: figures,
        equations: equations,
        structures: structures,
        items: items,
      });
    }

    // Output JSON to stdout
    console.log(JSON.stringify({ success: true, pages, totalTextLength }));
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  }
}

extract();
