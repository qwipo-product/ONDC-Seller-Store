import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Single error row in a validated bulk-import file. The standardized
 * shape is enforced across every importer (Add SKU, Price & Stock,
 * future modules) so the results table reads identically everywhere.
 */
export interface BulkImportError {
  row: number;
  field: string;
  error: string;
  /** Optional SKU-level grouping key — used for toasts and as a
   *  last-resort fallback. Prefer `skuName` for the on-screen
   *  table; that's the verbatim value from the upload. */
  skuLabel?: string;
  /** Raw SKU Code from the uploaded row, exactly as typed (may be
   *  empty if the user left the cell blank). Drives the on-screen
   *  summary's first column and the downloadable report. */
  skuCode?: string;
  /** Raw SKU Name from the uploaded row, exactly as typed (may be
   *  empty if the user left the cell blank). Drives the on-screen
   *  summary's second column. */
  skuName?: string;
  /** Raw value the user typed in the offending cell. Surfaced in the
   *  downloadable error report so the operator can see exactly what
   *  needs to change without re-opening the source file. */
  value?: string;
}

export interface BulkImportValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: BulkImportError[];
  /**
   * Opaque payload of valid rows that gets handed back to onImport.
   * Each module shapes this differently — the dialog never reads it.
   */
  validData: unknown[];
}

export interface BulkImportConfig {
  /** Dialog title — module-specific copy. */
  title: string;
  /** One-line description shown under the title. */
  description?: string;
  /** Module-specific instructions shown in the upload step body. */
  instructions?: ReactNode;
  /** Optional sample template the user can download before uploading. */
  sample?: {
    /**
     * Click handler — module owns whether this triggers a download or
     * shows a sheet. When `formats` is provided, the caller receives the
     * chosen format value; otherwise it's invoked with no argument.
     */
    onDownload: (format?: string) => void | Promise<void>;
    /**
     * Optional fixed filename. Shown as a sub-line under "Sample template".
     * Omit when `formats` is provided — with a format picker there is no
     * single fixed filename to display.
     */
    fileName?: string;
    /**
     * Optional list of downloadable formats. When provided, clicking
     * Download opens a sub-dialog that lets the seller pick a format
     * (e.g. CSV vs XLSX). The picker passes the chosen `value` back to
     * `onDownload`. When omitted, Download fires immediately.
     */
    formats?: { value: string; label: string; description?: string }[];
  };
  /** File `accept` attribute — defaults to ".csv,.xlsx,.xls". */
  accept?: string;
  /**
   * Run validation on the uploaded file. The dialog wraps this in a
   * spinner (with optional simulated delay for demo purposes).
   * Throw to surface a fatal parse failure as a toast.
   */
  validate: (file: File) => Promise<BulkImportValidationResult>;
  /**
   * Final import — receives the `validData` payload from the
   * validation result. Called when the user clicks Import Valid Records.
   * Throw to surface a save failure as a toast.
   */
  onImport: (validData: unknown[]) => Promise<void> | void;
  /**
   * Toast shown after a successful import. Receives the validation
   * result so the message can include counts.
   */
  successToast?: (result: BulkImportValidationResult) => string;
  /**
   * Column headers for the two identity columns in the error summary
   * table and the downloadable error report. Defaults to the SKU
   * importer's labels so every existing caller is unchanged; modules
   * whose rows aren't SKUs (e.g. Customers (DMS), where a row is a
   * registration request) override them.
   */
  entityColumns?: { codeLabel: string; nameLabel: string };
  /**
   * Demo-mode simulated processing delay (ms). Defaults to 5 000 so
   * reviewers still see the loader experience without waiting half a
   * minute. Set to 0 in real builds where validate() takes its own
   * time.
   */
  simulateValidationDelayMs?: number;
}

type Step = "upload" | "validating" | "results" | "importing";

export function BulkImportDialog({
  open,
  onOpenChange,
  config,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: BulkImportConfig;
}) {
  const codeLabel = config.entityColumns?.codeLabel ?? "SKU Code";
  const nameLabel = config.entityColumns?.nameLabel ?? "SKU Name";
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset everything whenever the dialog closes so a fresh open never
  // shows leftover state from a previous flow.
  useEffect(() => {
    if (!open) {
      setStep("upload");
      setFile(null);
      setResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  // Block close interaction while validation or import is running so a
  // mis-click can't abort an in-flight action.
  const isBusy = step === "validating" || step === "importing";
  const handleOpenChange = (v: boolean) => {
    if (isBusy && !v) return;
    onOpenChange(v);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setStep("validating");
    try {
      const delay = config.simulateValidationDelayMs ?? 5_000;
      const [validation] = await Promise.all([
        config.validate(file),
        delay > 0
          ? new Promise<void>((r) => setTimeout(r, delay))
          : Promise.resolve(),
      ]);
      setResult(validation);
      setStep("results");
    } catch (err) {
      console.error("[BulkImportDialog] validate failed", err);
      toast.error("Couldn't read the file — please check the format and try again.");
      setStep("upload");
    }
  };

  const handleReupload = () => {
    setFile(null);
    setResult(null);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadErrors = () => {
    if (!result || result.errors.length === 0) return;
    // Phase 2 spec: the downloadable report carries the full
    // SKU Code / SKU Name / Field / Value / Message detail. The
    // on-screen UI only shows a simplified
    // "{SKU Name} | {error count}" summary.
    const header = [
      codeLabel,
      nameLabel,
      "Column / Field",
      "Value Entered",
      "Validation Message",
    ];
    const lines = [header.join(",")];
    for (const e of result.errors) {
      // Both SKU Code and SKU Name come straight from the uploaded
      // row — no derived "SKU 12345" or "Row 7" stand-ins. Blank
      // cells stay blank so the report mirrors what the user actually
      // typed and the operator can match it back to the file.
      lines.push(
        [
          escapeCsv(e.skuCode ?? ""),
          escapeCsv(e.skuName ?? ""),
          escapeCsv(e.field),
          escapeCsv(e.value ?? ""),
          escapeCsv(e.error),
        ].join(","),
      );
    }
    const csv = lines.join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `bulk-import-errors-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${result.errors.length} error rows.`);
  };

  const handleImport = async () => {
    if (!result || result.validRows === 0) return;
    setStep("importing");
    try {
      await config.onImport(result.validData);
      const message =
        config.successToast?.(result) ??
        `${result.validRows} record${result.validRows === 1 ? "" : "s"} imported successfully.${
          result.invalidRows > 0
            ? ` ${result.invalidRows} record${result.invalidRows === 1 ? "" : "s"} failed validation and ${result.invalidRows === 1 ? "was" : "were"} skipped.`
            : ""
        }`;
      toast.success(message);
      onOpenChange(false);
    } catch (err) {
      console.error("[BulkImportDialog] import failed", err);
      toast.error("Import failed — please retry.");
      setStep("results");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!max-w-[min(95vw,900px)] w-[min(95vw,900px)] max-h-[92vh] overflow-hidden p-0 flex flex-col gap-0"
        // Block the default close button + Esc when a step is busy. The
        // Radix Dialog doesn't expose a clean prop for this, so we
        // intercept the events.
        onEscapeKeyDown={(e) => {
          if (isBusy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (isBusy) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isBusy) e.preventDefault();
        }}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-gray-100">
          <DialogTitle className="text-base font-semibold m-0">{config.title}</DialogTitle>
          {config.description && (
            <DialogDescription className="text-xs text-gray-500">
              {config.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {step === "upload" && (
            <UploadStep
              file={file}
              fileInputRef={fileInputRef}
              accept={config.accept ?? ".csv,.xlsx,.xls"}
              onFileChange={handleFileChange}
              onClearFile={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              instructions={config.instructions}
              sample={config.sample}
            />
          )}
          {step === "validating" && <ValidatingStep />}
          {step === "importing" && <ImportingStep />}
          {step === "results" && result && <ResultsStep result={result} />}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-gray-100 gap-2 sm:gap-2 flex-row sm:flex-row justify-end">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!file} className="gap-2">
                <Upload className="h-4 w-4" />
                Submit
              </Button>
            </>
          )}
          {(step === "validating" || step === "importing") && (
            <Button variant="outline" disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {step === "validating" ? "Validating…" : "Importing…"}
            </Button>
          )}
          {step === "results" && result && (
            <>
              <Button variant="outline" onClick={handleReupload} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Re-upload File
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadErrors}
                disabled={result.errors.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Error Report
              </Button>
              <Button
                onClick={handleImport}
                disabled={result.validRows === 0}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Import {result.validRows} Valid Record
                {result.validRows === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Step bodies ----------

function UploadStep({
  file,
  fileInputRef,
  accept,
  onFileChange,
  onClearFile,
  instructions,
  sample,
}: {
  file: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  instructions?: ReactNode;
  sample?: BulkImportConfig["sample"];
}) {
  return (
    <div className="px-6 py-5 space-y-4">
      {instructions && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-900 leading-relaxed">
          {instructions}
        </div>
      )}

      {sample && (
        <SampleTemplateRow sample={sample} />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={onFileChange}
        className="hidden"
      />

      {!file ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 transition-colors px-6 py-10 flex flex-col items-center gap-2 text-gray-600"
        >
          <Upload className="h-8 w-8 text-blue-500" />
          <p className="text-sm font-medium text-gray-900">
            Click to upload your file
          </p>
          <p className="text-[11px] text-gray-500">
            CSV, XLSX or XLS — up to 10 MB
          </p>
        </button>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
            <p className="text-[11px] text-gray-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={onClearFile}
            className="rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ValidatingStep() {
  return (
    <div className="px-6 py-16 flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
      <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
      <div>
        <p className="text-base font-semibold text-gray-900">
          Validating uploaded records…
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Please wait while we process your file.
        </p>
      </div>
    </div>
  );
}

function ImportingStep() {
  return (
    <div className="px-6 py-16 flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
      <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
      <div>
        <p className="text-base font-semibold text-gray-900">Importing records…</p>
        <p className="text-sm text-gray-500 mt-1">
          Saving your validated records to the catalog.
        </p>
      </div>
    </div>
  );
}

function ResultsStep({ result }: { result: BulkImportValidationResult }) {
  return (
    <div className="px-6 py-5 space-y-4">
      {/* Summary header */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 m-0">
          Import Validation Completed
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Review the results below, then import only the valid records.
        </p>
      </div>

      {/* Summary cards — Total / Valid / Invalid */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Total Records"
          value={result.totalRows}
          tone="neutral"
        />
        <SummaryCard
          label="Valid Records"
          value={result.validRows}
          tone="success"
        />
        <SummaryCard
          label="Invalid Records"
          value={result.invalidRows}
          tone={result.invalidRows > 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Simplified SKU-grouped error summary. Phase 2 spec: keep the
          UI light because a full row × field × message table at SKU
          scale is unreadable. We collapse to "{SKU Name} | {N errors}"
          and rely on the Download Error Report button below to carry
          the detailed breakdown. */}
      {result.errors.length > 0 ? (
        <div className="rounded-lg border border-red-200 overflow-hidden">
          <div className="bg-red-50 px-4 py-2 border-b border-red-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm font-semibold text-red-900">
                {result.errors.length} validation error
                {result.errors.length === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-[11px] text-red-700">
              Download the report below for full row-level details.
            </p>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-gray-700 w-44">
                    {codeLabel}
                  </th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-700">
                    {nameLabel}
                  </th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-700 w-24">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  // Group errors by row. Show the raw SKU Code and
                  // SKU Name exactly as the user typed them in the
                  // file — including blanks (rendered as "—"). We
                  // DON'T derive a synthetic label like "SKU 12345" or
                  // "Row 7" for the visible columns, because the spec
                  // wants the file's own values surfaced. Row number
                  // is used purely as a grouping key for blank rows.
                  type Bucket = {
                    code: string;
                    name: string;
                    count: number;
                  };
                  const groups = new Map<string, Bucket>();
                  result.errors.forEach((e) => {
                    const code = e.skuCode?.trim() ?? "";
                    const name = e.skuName?.trim() ?? "";
                    // Group key: code first, name second, row last so
                    // even rows with blank SKU Code+Name still bucket
                    // together per spreadsheet row.
                    const key = code || name || `__row_${e.row}`;
                    const bucket = groups.get(key);
                    if (bucket) {
                      bucket.count += 1;
                      if (!bucket.code && code) bucket.code = code;
                      if (!bucket.name && name) bucket.name = name;
                    } else {
                      groups.set(key, { code, name, count: 1 });
                    }
                  });
                  const rows = Array.from(groups.values()).sort(
                    (a, b) => b.count - a.count,
                  );
                  return rows.map((b, i) => (
                    <tr key={`${b.code}-${b.name}-${i}`} className="hover:bg-gray-50">
                      <td
                        className={`px-4 py-2 font-mono truncate max-w-[180px] ${
                          b.code ? "text-gray-700" : "text-gray-400 italic"
                        }`}
                        title={b.code || "Blank in file"}
                      >
                        {b.code || "—"}
                      </td>
                      <td
                        className={`px-4 py-2 truncate max-w-[420px] ${
                          b.name ? "text-gray-900" : "text-gray-400 italic"
                        }`}
                        title={b.name || "Blank in file"}
                      >
                        {b.name || "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                          {b.count}
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p className="text-sm text-emerald-900">
            All records passed validation — ready to import.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "danger";
}) {
  const palette =
    tone === "success"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : tone === "danger"
        ? "bg-red-50 border-red-200 text-red-700"
        : "bg-gray-50 border-gray-200 text-gray-700";
  return (
    <div className={`rounded-lg border px-4 py-3 ${palette}`}>
      <p className="text-2xl font-semibold leading-none">{value}</p>
      <p className="text-[11px] mt-1.5 uppercase tracking-wider opacity-80">
        {label}
      </p>
    </div>
  );
}

/**
 * "Sample template" row inside the upload step.
 *
 * Two flavours:
 *  - Legacy: a fixed `fileName` is provided. Clicking Download fires
 *    `onDownload()` immediately.
 *  - Multi-format: `formats` is provided. The filename line is hidden,
 *    and clicking Download opens a small picker dialog so the seller
 *    can choose CSV / XLSX / etc; the chosen format value is then
 *    forwarded to `onDownload(format)`.
 */
function SampleTemplateRow({
  sample,
}: {
  sample: NonNullable<BulkImportConfig["sample"]>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasFormats = !!sample.formats && sample.formats.length > 0;

  const handleClick = async () => {
    if (hasFormats) {
      setPickerOpen(true);
      return;
    }
    await sample.onDownload();
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">Sample template</p>
            {/* Show the filename only when no format picker is involved.
                With multi-format downloads there is no single fixed
                filename to display before the seller picks. */}
            {!hasFormats && sample.fileName && (
              <p className="text-[11px] text-gray-500">{sample.fileName}</p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleClick} className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      {hasFormats && (
        <FormatPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          formats={sample.formats!}
          onConfirm={async (format) => {
            setPickerOpen(false);
            await sample.onDownload(format);
          }}
        />
      )}
    </>
  );
}

/**
 * Sub-dialog that lets the seller pick which file format to download.
 * Renders each option as a clickable card; the chosen value is sent
 * back through `onConfirm`.
 */
function FormatPickerDialog({
  open,
  onClose,
  formats,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  formats: { value: string; label: string; description?: string }[];
  onConfirm: (format: string) => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<string>(formats[0]?.value ?? "");
  // Reset to the first option each time the dialog re-opens so a
  // previous session's choice doesn't sticky-carry into the next.
  useEffect(() => {
    if (open) setPicked(formats[0]?.value ?? "");
  }, [open, formats]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Download Sample Template
          </DialogTitle>
          <DialogDescription>
            Pick the file format you want — the template will download
            with your existing catalog pre-filled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {formats.map((f) => {
            const isSelected = picked === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setPicked(f.value)}
                className={`w-full text-left flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  isSelected
                    ? "border-blue-400 bg-blue-50/60"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div
                  className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    isSelected
                      ? "border-blue-600"
                      : "border-gray-300"
                  }`}
                >
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {f.label}
                  </p>
                  {f.description && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {f.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(picked)} disabled={!picked} className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- helpers ----------

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
