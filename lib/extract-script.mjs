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

      // Smart text joining - only add space when there's a gap
      let pageText = "";
      items.forEach((item, index) => {
        if (index === 0) {
          pageText = item.text;
        } else {
          const prevItem = items[index - 1];
          const gap = item.x - (prevItem.x + prevItem.width);

          // Add space if there's a gap > 1 unit or if it's a new line
          const isNewLine = Math.abs(item.y - prevItem.y) > 5;
          const hasGap = gap > 1;

          if (isNewLine) {
            pageText += "\n" + item.text;
          } else if (
            hasGap ||
            item.text.startsWith(" ") ||
            prevItem.text.endsWith(" ")
          ) {
            pageText += " " + item.text;
          } else {
            pageText += item.text;
          }
        }
      });

      totalTextLength += pageText.length;

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        textLength: pageText.length,
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
