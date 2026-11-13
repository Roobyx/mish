import { decodeReport, MAX_REPORT_BYTES, ReportError } from "./report.js";

interface WorkerScope {
  onmessage: ((event: MessageEvent<File>) => void) | null;
  postMessage: (message: unknown) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = async (event) => {
  const file = event.data;
  try {
    if (file.size > MAX_REPORT_BYTES) {
      throw new ReportError("The report is larger than 64 MB.");
    }
    const report = decodeReport(await file.text());
    scope.postMessage({ ok: true, report });
  } catch (cause) {
    scope.postMessage({
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
};
