"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Navigation, Search, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""
const MAP_ID = "attendance-map-picker" // required for AdvancedMarker
const DEFAULT_CENTER = { lat: 19.076, lng: 72.8777 } // Mumbai default
const DEFAULT_ZOOM = 14

// ─── Radius Circle Overlay ──────────────────────────────────────────────────
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
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#22c55e",
        fillOpacity: 0.12,
        clickable: false,
      })
    } else {
      circleRef.current.setCenter(center)
      circleRef.current.setRadius(radius)
    }

    return () => {
      // Keep circle alive — only destroy on full unmount
    }
  }, [map, mapsLib, center, radius])

  // Cleanup on unmount
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

// ─── Search Box ──────────────────────────────────────────────────────────────
function MapSearchBox({
  onPlaceSelect,
}: {
  onPlaceSelect: (lat: number, lng: number, address: string) => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const geocodingLib = useMapsLibrary("geocoding")

  const handleSearch = async () => {
    if (!searchQuery.trim() || !geocodingLib) return
    setSearching(true)
    try {
      const geocoder = new geocodingLib.Geocoder()
      const result = await geocoder.geocode({ address: searchQuery })
      if (result.results.length > 0) {
        const loc = result.results[0].geometry.location
        const addr = result.results[0].formatted_address
        onPlaceSelect(loc.lat(), loc.lng(), addr)
      } else {
        toast({
          title: "Not found",
          description: "No results for that search",
          variant: "destructive",
        })
      }
    } catch (err: any) {
      toast({
        title: "Geocoding failed",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search address or place..."
          className="pl-9 text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleSearch}
        disabled={searching}
        className="shrink-0"
      >
        {searching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface MapPickerLocation {
  lat: number
  lng: number
  address: string
}

interface GoogleMapPickerProps {
  initialLat?: number
  initialLng?: number
  initialRadius?: number
  initialAddress?: string
  onLocationChange: (location: MapPickerLocation) => void
  onRadiusChange: (radius: number) => void
  radius: number
  height?: string
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function GoogleMapPicker({
  initialLat,
  initialLng,
  initialRadius = 100,
  initialAddress = "",
  onLocationChange,
  onRadiusChange,
  radius,
  height = "350px",
}: GoogleMapPickerProps) {
  const [markerPos, setMarkerPos] = useState<{
    lat: number
    lng: number
  } | null>(
    initialLat && initialLng
      ? { lat: initialLat, lng: initialLng }
      : null
  )
  const [gettingLocation, setGettingLocation] = useState(false)
  const [address, setAddress] = useState(initialAddress)

  // Reverse-geocode on marker position change
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const resp = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}`
        )
        const data = await resp.json()
        if (data.results && data.results.length > 0) {
          const addr = data.results[0].formatted_address
          setAddress(addr)
          onLocationChange({ lat, lng, address: addr })
        } else {
          onLocationChange({ lat, lng, address: "" })
        }
      } catch {
        onLocationChange({ lat, lng, address: "" })
      }
    },
    [onLocationChange]
  )

  // Handle map click
  const handleMapClick = useCallback(
    (e: any) => {
      const lat = e.detail?.latLng?.lat
      const lng = e.detail?.latLng?.lng
      if (lat != null && lng != null) {
        setMarkerPos({ lat, lng })
        reverseGeocode(lat, lng)
      }
    },
    [reverseGeocode]
  )

  // Handle "Get My Location"
  const handleGetMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: "Not supported",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      })
      return
    }
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setMarkerPos({ lat, lng })
        reverseGeocode(lat, lng)
        setGettingLocation(false)
      },
      (err) => {
        toast({
          title: "Location error",
          description: err.message,
          variant: "destructive",
        })
        setGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [reverseGeocode])

  // Handle search result
  const handlePlaceSelect = useCallback(
    (lat: number, lng: number, addr: string) => {
      setMarkerPos({ lat, lng })
      setAddress(addr)
      onLocationChange({ lat, lng, address: addr })
    },
    [onLocationChange]
  )

  const RADIUS_PRESETS = [50, 100, 150, 200, 300, 500, 1000]

  const mapCenter = markerPos ?? DEFAULT_CENTER
  const mapZoom = markerPos ? 16 : DEFAULT_ZOOM

  return (
    <div className="space-y-3">
      {/* Search + Get My Location */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <MapSearchBox onPlaceSelect={handlePlaceSelect} />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGetMyLocation}
          disabled={gettingLocation}
          className="shrink-0 gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
        >
          {gettingLocation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          Get My Location
        </Button>
      </div>

      {/* Map */}
      <APIProvider apiKey={MAPS_KEY}>
        <div
          className="rounded-lg overflow-hidden border shadow-sm"
          style={{ height }}
        >
          <Map
            defaultCenter={mapCenter}
            defaultZoom={mapZoom}
            center={mapCenter}
            zoom={mapZoom}
            mapId={MAP_ID}
            onClick={handleMapClick}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={true}
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={true}
            style={{ width: "100%", height: "100%" }}
          >
            {markerPos && (
              <>
                <AdvancedMarker
                  position={markerPos}
                  draggable={true}
                  onDragEnd={(e) => {
                    const lat = e.latLng?.lat()
                    const lng = e.latLng?.lng()
                    if (lat != null && lng != null) {
                      setMarkerPos({ lat, lng })
                      reverseGeocode(lat, lng)
                    }
                  }}
                >
                  <div className="flex flex-col items-center">
                    <div className="bg-green-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg mb-1 whitespace-nowrap">
                      📍 Drag to adjust
                    </div>
                    <MapPin className="h-8 w-8 text-green-600 drop-shadow-lg" />
                  </div>
                </AdvancedMarker>
                <RadiusCircle center={markerPos} radius={radius} />
              </>
            )}
          </Map>
        </div>
      </APIProvider>

      {!markerPos && (
        <p className="text-xs text-amber-600 text-center py-1">
          👆 Click on the map, search an address, or use &quot;Get My Location&quot; to set the attendance point
        </p>
      )}

      {/* Coordinates display */}
      {markerPos && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Latitude</Label>
            <Input
              value={markerPos.lat.toFixed(6)}
              readOnly
              className="bg-gray-50 text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Longitude</Label>
            <Input
              value={markerPos.lng.toFixed(6)}
              readOnly
              className="bg-gray-50 text-sm font-mono"
            />
          </div>
        </div>
      )}

      {/* Address */}
      {address && (
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Address</Label>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2 border">
            {address}
          </p>
        </div>
      )}

      {/* Radius Presets */}
      <div className="space-y-2">
        <Label className="text-xs text-gray-500">
          Geo-fence Radius:{" "}
          <span className="text-green-600 font-bold">
            {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
          </span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {RADIUS_PRESETS.map((r) => (
            <button
              key={r}
              onClick={() => onRadiusChange(r)}
              className={`px-3 py-1.5 text-xs rounded-full font-semibold border transition-all ${
                radius === r
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-green-400"
              }`}
            >
              {r >= 1000 ? `${r / 1000}km` : `${r}m`}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
