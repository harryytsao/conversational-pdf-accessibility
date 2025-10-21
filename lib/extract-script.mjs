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

        //Sort items by y (top to bottom) then x (left to right)
        items.sort((a, b) => {
          // If items are roughly on the same line (within 5 units), sort left-to-right
          if (Math.abs(a.y - b.y) > 5) return a.x - b.x;
          // Otherwise, sort top-to-bottom (higher y first)
          return b.y - a.y;
        });
      // Step 2: Join text fragments into continuous readable text
      let pageText = "";
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (index === 0) {
          //First text item on page: start the text
          pageText = item.text.trim();
          continue;
        }
        const prev = items[index - 1];
        // Determine spacing based on position
        const horrizontal_gap = item.x - (prev.x + prev.width);
        const vertical_gap = prev.y - item.y;
        //thresholds
        const same_line = 5; //within 5 units vertically is same line
        const space_threshold = item.fontSize * 0.1; //horrizontal gap greater than 10% of font size indicates space
        const paragraph_threshold = item.fontSize * 2.5; //horrizontal gap greater than 250% of font size indicates paragraph break
        const is_paragraph = vertical_gap > paragraph_threshold;
        const is_new_line = vertical_gap > same_line && vertical_gap <= paragraph_threshold;
        const has_gap = horrizontal_gap > space_threshold;
        //text joining rules
        if (is_paragraph) pageText += "\n\n" + item.text.trimStart();
        else if (is_new_line) pageText += "\n" + item.text.trimStart();
        else if (has_gap) pageText += " " + item.text.trimStart();
        else pageText += item.text;
      }

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
