"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps"
import { MapPin, Building2, UtensilsCrossed } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Cafeteria } from "@/lib/firestore/cafeteriasService"

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""
const MAP_ID = "cafeteria-locations-map"
const DEFAULT_CENTER = { lat: 19.076, lng: 72.8777 }

// ─── Radius circle for selected cafeteria ────────────────────────────────────
function RadiusCircle({
  center,
  radius,
}: {
  center: { lat: number; lng: number }
  radius: number
}) {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")
  const circleRef = useRef<google.maps.Circle | null>(null)

  useEffect(() => {
    if (!map || !mapsLib) return

    if (!circleRef.current) {
      circleRef.current = new mapsLib.Circle({
        map,
        center,
        radius,
        strokeColor: "#22c55e",
        strokeOpacity: 0.7,
        strokeWeight: 2,
        fillColor: "#22c55e",
        fillOpacity: 0.1,
        clickable: false,
      })
    } else {
      circleRef.current.setCenter(center)
      circleRef.current.setRadius(radius)
    }
  }, [map, mapsLib, center, radius])

  useEffect(() => {
    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null)
        circleRef.current = null
      }
    }
  }, [])

  return null
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface CafeteriaLocationsMapProps {
  cafeterias: (Cafeteria & {
    companyName?: string
    buildingName?: string
  })[]
  height?: string
  onCafeteriaClick?: (cafeteria: Cafeteria) => void
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CafeteriaLocationsMap({
  cafeterias,
  height = "400px",
  onCafeteriaClick,
}: CafeteriaLocationsMapProps) {
  const [selectedCafe, setSelectedCafe] = useState<
    (Cafeteria & { companyName?: string; buildingName?: string }) | null
  >(null)

  // Filter cafeterias that have geo data
  const geoEnabled = cafeterias.filter(
    (c) => c.latitude != null && c.longitude != null
  )

  // Calculate bounds center
  const mapCenter =
    geoEnabled.length > 0
      ? {
          lat:
            geoEnabled.reduce((s, c) => s + (c.latitude ?? 0), 0) /
            geoEnabled.length,
          lng:
            geoEnabled.reduce((s, c) => s + (c.longitude ?? 0), 0) /
            geoEnabled.length,
        }
      : DEFAULT_CENTER

  const mapZoom = geoEnabled.length === 1 ? 16 : geoEnabled.length > 1 ? 12 : 10

  return (
    <APIProvider apiKey={MAPS_KEY}>
      <div
        className="rounded-lg overflow-hidden border shadow-sm"
        style={{ height }}
      >
        <Map
          defaultCenter={mapCenter}
          defaultZoom={mapZoom}
          mapId={MAP_ID}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          zoomControl={true}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={true}
          style={{ width: "100%", height: "100%" }}
        >
          {geoEnabled.map((cafe) => (
            <AdvancedMarker
              key={cafe.id}
              position={{
                lat: cafe.latitude!,
                lng: cafe.longitude!,
              }}
              onClick={() => setSelectedCafe(cafe)}
            >
              <div className="flex flex-col items-center cursor-pointer group">
                <div className="bg-green-600 text-white p-1.5 rounded-full shadow-lg group-hover:scale-110 transition-transform">
                  <UtensilsCrossed className="h-4 w-4" />
                </div>
              </div>
            </AdvancedMarker>
          ))}

          {selectedCafe && selectedCafe.latitude && selectedCafe.longitude && (
            <>
              <InfoWindow
                position={{
                  lat: selectedCafe.latitude,
                  lng: selectedCafe.longitude,
                }}
                onCloseClick={() => setSelectedCafe(null)}
                pixelOffset={[0, -35]}
              >
                <div className="min-w-[200px] p-1">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5 mb-1">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-green-600" />
                    {selectedCafe.name}
                  </h3>
                  <div className="text-xs text-gray-500 space-y-0.5 mb-2">
                    {selectedCafe.companyName && (
                      <p className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {selectedCafe.companyName}
                      </p>
                    )}
                    {selectedCafe.buildingName && (
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedCafe.buildingName}
                      </p>
                    )}
                    {selectedCafe.address && (
                      <p className="text-gray-400 mt-1">
                        📍 {selectedCafe.address}
                      </p>
                    )}
                    <p>
                      ⭕ Radius:{" "}
                      {(selectedCafe.radius ?? 100) >= 1000
                        ? `${(selectedCafe.radius ?? 100) / 1000}km`
                        : `${selectedCafe.radius ?? 100}m`}
                    </p>
                    {selectedCafe.shiftStart && (
                      <p>
                        ⏰ {selectedCafe.shiftStart} – {selectedCafe.shiftEnd}
                      </p>
                    )}
                  </div>
                  {onCafeteriaClick && (
                    <button
                      className="text-xs text-green-600 font-semibold hover:underline"
                      onClick={() => {
                        onCafeteriaClick(selectedCafe)
                        setSelectedCafe(null)
                      }}
                    >
                      Edit Location →
                    </button>
                  )}
                </div>
              </InfoWindow>
              <RadiusCircle
                center={{
                  lat: selectedCafe.latitude,
                  lng: selectedCafe.longitude,
                }}
                radius={selectedCafe.radius ?? 100}
              />
            </>
          )}
        </Map>
      </div>

      {geoEnabled.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400">
            No cafeterias have locations set yet.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="bg-green-600 text-white p-0.5 rounded-full">
            <UtensilsCrossed className="h-2.5 w-2.5" />
          </div>
          Location set ({geoEnabled.length})
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <div className="h-3 w-3 rounded-full border-2 border-dashed border-gray-300" />
          No location ({cafeterias.length - geoEnabled.length})
        </div>
      </div>
    </APIProvider>
  )
}
