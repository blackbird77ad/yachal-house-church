export const REPORT_PRINT_AREA_ID = "report-print-area";

let pdfDependenciesPromise;

const sanitizeFileName = (value) =>
  String(value || "report")
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      return code <= 31 || '<>:"/\\|?*'.includes(char) ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

export const buildReportPdfFileName = ({ typeLabel, workerName, weekReference, status }) => {
  const weekPart = weekReference
    ? new Date(weekReference).toISOString().slice(0, 10)
    : "undated";
  const statusPart = status === "draft" ? "draft" : "submitted";

  return sanitizeFileName(`${typeLabel} - ${workerName} - ${weekPart} - ${statusPart}.pdf`);
};

export const downloadReportPdf = async ({ element, fileName }) => {
  if (!element) throw new Error("Report content not found.");

  if (!pdfDependenciesPromise) {
    pdfDependenciesPromise = Promise.all([import("html2canvas"), import("jspdf")]).then(
      ([html2canvasModule, jspdfModule]) => ({
        html2canvas: html2canvasModule.default,
        jsPDF: jspdfModule.jsPDF,
      })
    );
  }

  const { html2canvas, jsPDF } = await pdfDependenciesPromise;

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue even if font readiness is unavailable.
    }
  }

  await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

  const captureElement = element.cloneNode(true);
  captureElement.id = `${REPORT_PRINT_AREA_ID}-pdf-capture`;
  Object.assign(captureElement.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "794px",
    maxWidth: "794px",
    margin: "0",
    backgroundColor: "#ffffff",
    color: "#111827",
    boxSizing: "border-box",
  });
  document.body.appendChild(captureElement);

  let canvas;
  try {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas = await html2canvas(captureElement, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: captureElement.scrollWidth,
      windowHeight: captureElement.scrollHeight,
    });
  } finally {
    captureElement.remove();
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const safeFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = (canvas.height * contentWidth) / canvas.width;
  const printableHeight = pageHeight - margin * 2;
  const imageData = canvas.toDataURL("image/jpeg", 0.95);

  let remainingHeight = contentHeight;
  let positionY = margin;

  pdf.addImage(imageData, "JPEG", margin, positionY, contentWidth, contentHeight, undefined, "FAST");
  remainingHeight -= printableHeight;

  while (remainingHeight > 0) {
    pdf.addPage();
    positionY = margin - (contentHeight - remainingHeight);
    pdf.addImage(imageData, "JPEG", margin, positionY, contentWidth, contentHeight, undefined, "FAST");
    remainingHeight -= printableHeight;
  }

  if (typeof File !== "undefined" && navigator?.share && navigator?.canShare) {
    try {
      const blob = pdf.output("blob");
      const file = new File([blob], safeFileName, { type: "application/pdf" });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: safeFileName.replace(/\.pdf$/i, ""),
        });
        return;
      }
    } catch {
      // Fall back to direct download.
    }
  }

  pdf.save(safeFileName);
};
