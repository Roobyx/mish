import {
  decodeReport,
  encodeReport,
  MAX_REPORT_BYTES,
  type MishReport,
  ReportError,
} from "./report.js";

type ReportWorkerResult = { ok: true; report: MishReport } | { ok: false; error: string };

/** Download a report as a `.mish` file. */
export function downloadReport(report: MishReport, fileName: string): void {
  const blob = new Blob([encodeReport(report)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function decodeInWorker(file: File): Promise<MishReport> {
  return new Promise<MishReport>((resolve, reject) => {
    const worker = new Worker(new URL("./report-worker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      worker.terminate();
      action();
    };
    worker.onmessage = (event: MessageEvent<ReportWorkerResult>) => {
      const result = event.data;
      if (result.ok) finish(() => resolve(result.report));
      else finish(() => reject(new ReportError(result.error)));
    };
    worker.onerror = (event) => {
      finish(() => reject(new ReportError(event.message || "Could not read the report.")));
    };
    try {
      worker.postMessage(file);
    } catch (cause) {
      finish(() => reject(new ReportError(cause instanceof Error ? cause.message : String(cause))));
    }
  });
}

/** Read and validate a `.mish` file picked by the user. */
export async function readReportFile(file: File): Promise<MishReport> {
  if (file.size > MAX_REPORT_BYTES) {
    throw new ReportError("The report is larger than 64 MB.");
  }
  if (typeof Worker === "undefined") {
    return decodeReport(await file.text());
  }
  return decodeInWorker(file);
}
