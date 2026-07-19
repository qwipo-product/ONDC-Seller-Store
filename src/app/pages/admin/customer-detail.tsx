// Admin → Customer Database → Customer Detail
// -----------------------------------------------------------------
// One uploaded customer: where they sit on the map, and exactly which
// companies / beats / delivery days cover that point. This is the
// "why is this customer (not) serviceable" debugging view.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Building2,
  CheckCircle2,
  XCircle,
  Hash,
} from "lucide-react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject } from "geojson";
import { EmptyState } from "../../components/empty-state";
import {
  getCustomerById,
  groupByCompany,
  matchCustomer,
  subscribeToCustomers,
} from "../../lib/customer-database";
import {
  haversineKm,
  sortDeliveryDays,
  subscribeToServiceabilityBeats,
  type ServiceabilityBeat,
} from "../../lib/serviceability-data";
import { getSellerById } from "../../lib/mock-store";

// Same palette family as the Serviceability map view so beats keep a
// consistent visual language across admin surfaces.
const BEAT_COLORS = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
];

const CUSTOMER_ICON = L.divIcon({
  className: "qwipo-customer-marker",
  html: `
    <div style="
      width: 30px; height: 30px;
      background: #dc2626;
      border: 3px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        width: 10px; height: 10px; background: #fff; border-radius: 50%;
      "></div>
    </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 28],
});

function FitToContent({
  lat,
  lng,
  beats,
}: {
  lat: number;
  lng: number;
  beats: ServiceabilityBeat[];
}) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([[lat, lng]]);
    for (const b of beats) {
      try {
        const g = L.geoJSON(b.polygonData as GeoJsonObject).getBounds();
        if (g.isValid()) bounds.extend(g);
      } catch {
        /* skip bad geometry */
      }
    }
    map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
  }, [map, lat, lng, beats]);
  return null;
}

export function AdminCustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  useEffect(() => {
    const un1 = subscribeToCustomers(() => setTick((t) => t + 1));
    const un2 = subscribeToServiceabilityBeats(() => setTick((t) => t + 1));
    return () => {
      un1();
      un2();
    };
  }, []);

  const customer = customerId ? getCustomerById(customerId) : undefined;

  const matchedBeats = useMemo(
    () => (customer ? matchCustomer(customer) : []),
    [customer],
  );
  const companies = useMemo(() => groupByCompany(matchedBeats), [matchedBeats]);

  if (!customer) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={MapPin}
              title="Customer not found"
              description="This customer is not in the uploaded database — it may have been removed or the database was cleared."
              action={
                <Button onClick={() => navigate("/admin/customers")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Customer Database
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/customers")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">
            {customer.name}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-0.5">
            {customer.customerId && (
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {customer.customerId}
              </span>
            )}
            {customer.mobile && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {customer.mobile}
              </span>
            )}
            <span className="flex items-center gap-1 font-mono text-xs">
              <MapPin className="h-3.5 w-3.5" />
              {customer.lat.toFixed(6)}, {customer.lng.toFixed(6)}
            </span>
          </div>
        </div>
        {companies.length > 0 ? (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-sm px-3 py-1">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Serviceable by {companies.length}{" "}
            {companies.length === 1 ? "company" : "companies"}
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-sm px-3 py-1">
            <XCircle className="h-4 w-4 mr-1.5" />
            Not serviceable
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Map */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="h-[420px]">
              <MapContainer
                center={[customer.lat, customer.lng]}
                zoom={13}
                className="h-full w-full"
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitToContent
                  lat={customer.lat}
                  lng={customer.lng}
                  beats={matchedBeats}
                />
                {matchedBeats.map((beat, i) => {
                  const color = BEAT_COLORS[i % BEAT_COLORS.length];
                  return (
                    <GeoJSON
                      key={beat.id}
                      data={beat.polygonData as GeoJsonObject}
                      style={{
                        color,
                        weight: 2,
                        fillColor: color,
                        fillOpacity: 0.12,
                      }}
                    />
                  );
                })}
                <Marker
                  position={[customer.lat, customer.lng]}
                  icon={CUSTOMER_ICON}
                  zIndexOffset={1000}
                >
                  <Popup>
                    <strong>{customer.name}</strong>
                    <br />
                    {customer.lat.toFixed(5)}, {customer.lng.toFixed(5)}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
            <p className="p-3 text-xs text-gray-500 border-t border-gray-100">
              Red pin = customer location. Shaded areas = the delivery-beat
              polygons that contain this customer.
            </p>
          </CardContent>
        </Card>

        {/* Serviceability breakdown */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">
                Company Serviceability
              </h3>
            </div>
            {matchedBeats.length === 0 ? (
              <EmptyState
                compact
                icon={XCircle}
                title="No beats cover this location"
                description="This customer's lat/long does not fall inside any company's delivery-beat polygon. Upload or extend beat polygons under Sellers → Serviceability."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Beat</TableHead>
                    <TableHead>Delivery Days</TableHead>
                    <TableHead>Distance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedBeats.map((beat, i) => {
                    const seller = beat.sellerId
                      ? getSellerById(beat.sellerId)
                      : undefined;
                    const sellerName = seller?.name ?? beat.sellerName;
                    const distanceKm =
                      seller?.latitude != null && seller?.longitude != null
                        ? haversineKm(
                            customer.lat,
                            customer.lng,
                            seller.latitude,
                            seller.longitude,
                          )
                        : null;
                    return (
                      <TableRow key={beat.id}>
                        <TableCell className="font-medium text-gray-900">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                background: BEAT_COLORS[i % BEAT_COLORS.length],
                              }}
                            />
                            {beat.companyName}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {sellerName || "—"}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {beat.beatName}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {sortDeliveryDays(beat.deliveryDays).map((d) => (
                              <Badge
                                key={d}
                                variant="secondary"
                                className="text-xs"
                              >
                                {d}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700 font-mono text-xs">
                          {distanceKm != null
                            ? `${distanceKm.toFixed(2)} km`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
