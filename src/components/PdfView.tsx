import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { cn } from "./ui";

/* ------------------------------------------------------------------
 * Oct 27 2026: the Delivery details PDF drawn inside the app (pdf.js), so the driver never leaves for a PDF viewer.
 * `first` draws only page 1 (the stop page preview); otherwise every page, one under the other.
 * `zoom` draws the pages wider than the box (2 = twice the width): a letter page at phone width has ~6 px text,
 * so the preview is zoomed onto the text, and the viewer can zoom in and scroll sideways.
 * The real app would use the platform's PDF view (PDFKit / Android PdfRenderer) the same way.
 * ------------------------------------------------------------------ */
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const docs = new Map<string, Promise<pdfjs.PDFDocumentProxy>>(); // loaded once, shared by preview and viewer
const load = (url: string) => {
  if (!docs.has(url)) docs.set(url, pdfjs.getDocument(url).promise);
  return docs.get(url)!;
};

export function PdfPages({ url, first, zoom = 1, crop, className }: { url: string; first?: boolean; zoom?: number; crop?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let stop = false;
    (async () => {
      try {
        const doc = await load(url);
        const count = first ? 1 : doc.numPages;
        const width = el.clientWidth * zoom;
        const ratio = window.devicePixelRatio || 1;
        el.replaceChildren();
        for (let n = 1; n <= count && !stop; n++) {
          const page = await doc.getPage(n);
          const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${zoom * 100}%`;
          canvas.style.maxWidth = "none";
          // Crop: skip the page's left margin (~9% of a letter page) so the preview starts at the text.
          if (crop) canvas.style.marginLeft = `-${zoom * 8}%`;
          canvas.style.display = "block";
          canvas.setAttribute("aria-label", `Page ${n}`);
          el.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        }
      } catch {
        if (!stop) setFailed(true);
      }
    })();
    return () => {
      stop = true;
    };
  }, [url, first, zoom, crop]);

  if (failed) return <div className={cn("grid place-items-center p-6 text-[13px] text-muted-foreground", className)}>Couldn't load the PDF</div>;
  return <div ref={box} className={cn("space-y-3 [&>canvas]:bg-white", className)} />;
}
