// Admin → Customer Database
// -----------------------------------------------------------------
// Upload the raw customer roster (CSV/XLSX with id, name, mobile,
// lat/long) and see, per customer, how many distributor companies can
// actually reach them — real point-in-polygon against every beat
// polygon configured under Sellers → Serviceability.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Users,
  Upload,
  Search,
  Download,
  Trash2,
  Eye,
  MapPin,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "../../components/empty-state";
import {
  addCustomers,
  clearCustomers,
  countDuplicateMobiles,
  downloadCustomerTemplate,
  getCustomers,
  makeSampleCustomers,
  matchCustomer,
  groupByCompany,
  parseCustomerFile,
  removeCustomer,
  subscribeToCustomers,
  type DbCustomer,
  type ParseResult,
} from "../../lib/customer-database";
import {
  subscribeToServiceabilityBeats,
} from "../../lib/serviceability-data";

export function AdminCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<DbCustomer[]>(getCustomers());
  const [search, setSearch] = useState("");
  // Bump when beats change so company-match counts recompute.
  const [beatsVersion, setBeatsVersion] = useState(0);

  useEffect(() => {
    const un1 = subscribeToCustomers(() => setCustomers([...getCustomers()]));
    const un2 = subscribeToServiceabilityBeats(() =>
      setBeatsVersion((v) => v + 1),
    );
    return () => {
      un1();
      un2();
    };
  }, []);

  // Per-customer company match counts. Memoized on the roster + beat
  // store version — point-in-polygon over a few thousand rows is
  // fast, but no reason to redo it per keystroke of search.
  const matchInfo = useMemo(() => {
    void beatsVersion;
    const map = new Map<string, { companies: number; beats: number }>();
    for (const c of customers) {
      const beats = matchCustomer(c);
      map.set(c.id, {
        companies: groupByCompany(beats).length,
        beats: beats.length,
      });
    }
    return map;
  }, [customers, beatsVersion]);

  const stats = useMemo(() => {
    let serviceable = 0;
    for (const c of customers) {
      if ((matchInfo.get(c.id)?.companies ?? 0) > 0) serviceable++;
    }
    return {
      total: customers.length,
      serviceable,
      notServiceable: customers.length - serviceable,
      coverage:
        customers.length === 0
          ? 0
          : Math.round((serviceable / customers.length) * 100),
    };
  }, [customers, matchInfo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.customerId.toLowerCase().includes(q) ||
        c.mobile.includes(q),
    );
  }, [customers, search]);

  // ---- Upload dialog ----
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openUpload = () => {
    setParseResult(null);
    setFileName(null);
    setReplaceExisting(false);
    setIsUploadOpen(true);
  };

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);
    try {
      const result = await parseCustomerFile(file);
      setParseResult(result);
      if (result.customers.length === 0 && result.errors.length > 0) {
        toast.error("Could not read any customers from the file");
      }
    } catch {
      setParseResult({
        customers: [],
        errors: ["Could not read the file. Is it a valid CSV or XLSX?"],
        totalRows: 0,
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Duplicate-mobile preview for the parsed batch — recomputed when
  // the roster changes underneath the open dialog.
  const duplicateCount = useMemo(
    () =>
      parseResult && parseResult.customers.length > 0
        ? countDuplicateMobiles(parseResult.customers)
        : 0,
    [parseResult, customers],
  );

  const confirmImport = () => {
    if (!parseResult || parseResult.customers.length === 0) return;
    const result = addCustomers(parseResult.customers, replaceExisting);
    if (result.added > 0) {
      toast.success(
        `Imported ${result.added} customer${result.added === 1 ? "" : "s"}${
          replaceExisting ? " (previous uploads replaced)" : ""
        }`,
      );
    }
    if (result.skippedDuplicates > 0) {
      toast.info(
        `${result.skippedDuplicates} row${
          result.skippedDuplicates === 1 ? "" : "s"
        } skipped — mobile number already exists`,
      );
    }
    if (result.added === 0 && result.skippedDuplicates === 0) {
      toast.error("Nothing to import");
    }
    setIsUploadOpen(false);
  };

  const loadSample = () => {
    addCustomers(makeSampleCustomers(30));
    toast.success("Loaded 30 sample customers around Hyderabad");
  };

  // ---- Clear-all confirm ----
  const [isClearOpen, setIsClearOpen] = useState(false);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Customer Database
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload your customer roster and see which distributor companies can
            reach each customer, based on the delivery-beat polygons.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={downloadCustomerTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          {customers.length > 0 && (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700"
              onClick={() => setIsClearOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          <Button onClick={openUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Customers
          </Button>
        </div>
      </div>

      {/* Stats */}
      {customers.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.total.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500">Total Customers</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.serviceable.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500">Serviceable</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.notServiceable.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500">Not Serviceable</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.coverage}%
                </p>
                <p className="text-xs text-gray-500">Coverage</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List */}
      {customers.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="No customers uploaded yet"
              description="Upload a CSV or Excel file with customer name, mobile number and lat/long to check serviceability against every company's delivery beats."
              action={
                <div className="flex items-center gap-2">
                  <Button onClick={openUpload}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Customers
                  </Button>
                  <Button variant="outline" onClick={loadSample}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Load Sample Data
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-gray-100">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, ID or mobile…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Beats</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 500).map((c) => {
                  const info = matchInfo.get(c.id) ?? { companies: 0, beats: 0 };
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/customers/${c.id}`)}
                    >
                      <TableCell className="font-mono text-xs text-gray-600">
                        {c.customerId || "—"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {c.mobile || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">
                        {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        {info.companies > 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            {info.companies}{" "}
                            {info.companies === 1 ? "company" : "companies"}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            Not serviceable
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {info.beats > 0 ? info.beats : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/customers/${c.id}`)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => {
                              removeCustomer(c.id);
                              toast.success(`Removed ${c.name}`);
                            }}
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length > 500 && (
              <p className="p-3 text-xs text-gray-500 border-t border-gray-100">
                Showing first 500 of {filtered.length.toLocaleString("en-IN")}{" "}
                matching customers — refine the search to narrow down.
              </p>
            )}
            {filtered.length === 0 && (
              <p className="p-6 text-sm text-gray-500 text-center">
                No customers match "{search}".
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Customers</DialogTitle>
            <DialogDescription>
              CSV or Excel with columns: Customer ID, Customer Name, Mobile
              Number, Latitude, Longitude. Lat/long is required — it drives the
              beat matching.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors rounded-xl p-8 flex flex-col items-center gap-2 text-center"
            >
              {isParsing ? (
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-8 w-8 text-blue-500" />
              )}
              <span className="text-sm font-medium text-gray-900">
                {fileName ?? "Click to choose a CSV / XLSX file"}
              </span>
              <span className="text-xs text-gray-500">
                Need the format?{" "}
                <span
                  className="text-blue-600 underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadCustomerTemplate();
                  }}
                >
                  Download template
                </span>
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />

            {parseResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-gray-900 font-medium">
                    {parseResult.customers.length} valid customer
                    {parseResult.customers.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-gray-500">
                    of {parseResult.totalRows} row
                    {parseResult.totalRows === 1 ? "" : "s"}
                  </span>
                </div>
                {duplicateCount > 0 && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p className="text-xs text-blue-800 flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                      {duplicateCount} row{duplicateCount === 1 ? "" : "s"} have
                      a mobile number that already exists in the database —
                      they will be skipped on import.
                    </p>
                  </div>
                )}
                {parseResult.errors.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1 max-h-32 overflow-y-auto">
                    {parseResult.errors.slice(0, 8).map((err, i) => (
                      <p
                        key={i}
                        className="text-xs text-amber-800 flex items-start gap-1.5"
                      >
                        <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                        {err}
                      </p>
                    ))}
                    {parseResult.errors.length > 8 && (
                      <p className="text-xs text-amber-700">
                        …and {parseResult.errors.length - 8} more issues (these
                        rows will be skipped).
                      </p>
                    )}
                  </div>
                )}
                {customers.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <Checkbox
                      checked={replaceExisting}
                      onCheckedChange={(v) => setReplaceExisting(v === true)}
                    />
                    Replace previously uploaded customers (the base roster
                    always stays)
                  </label>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmImport}
              disabled={!parseResult || parseResult.customers.length === 0}
            >
              Import{" "}
              {parseResult && parseResult.customers.length > 0
                ? `${parseResult.customers.length} Customer${
                    parseResult.customers.length === 1 ? "" : "s"
                  }`
                : "Customers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear-all confirm */}
      <AlertDialog open={isClearOpen} onOpenChange={setIsClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the customer database?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every uploaded customer and restores the database to
              the built-in base roster of 705 customers. Beat polygons under
              Sellers are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                clearCustomers();
                toast.success("Customer database reset to the base roster");
              }}
            >
              Reset Database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
