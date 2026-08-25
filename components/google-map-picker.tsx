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
const LIBRARIES: ("places" | "geocoding")[] = ["places", "geocoding"]

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
  const [resolvingLink, setResolvingLink] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const placesLib = useMapsLibrary("places")
  const geocodingLib = useMapsLibrary("geocoding")
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    
    // Initialize Autocomplete
    const ac = new placesLib.Autocomplete(inputRef.current, {
      fields: ["geometry", "formatted_address", "name"]
    });
    setAutocomplete(ac);
  }, [placesLib, inputRef]);

  useEffect(() => {
    if (!autocomplete) return;

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const addr = place.formatted_address || place.name || "";
        onPlaceSelect(lat, lng, addr);
        setSearchQuery(addr);
      } else {
        // They typed something and pressed enter without selecting from dropdown
        // Let's see if it's a URL or coordinates
        handleSpecialInput(searchQuery);
      }
    });

    return () => {
      if (listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [autocomplete, onPlaceSelect, searchQuery]);

  const handleSpecialInput = async (val: string) => {
    const text = val.trim();
    
    // 1. Check for raw Lat, Lng coordinates
    const latLngMatch = text.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
    if (latLngMatch) {
      const lat = parseFloat(latLngMatch[1]);
      const lng = parseFloat(latLngMatch[3]);
      
      let finalAddr = `Coordinates: ${lat}, ${lng}`;
      if (geocodingLib) {
        const geocoder = new geocodingLib.Geocoder();
        try {
          const geoRes = await geocoder.geocode({ location: { lat, lng } });
          if (geoRes.results.length > 0) {
            finalAddr = geoRes.results[0].formatted_address;
          }
        } catch (e) {
           console.error("Reverse geocoding failed", e);
        }
      }
      onPlaceSelect(lat, lng, finalAddr);
      setSearchQuery(finalAddr);
      toast({ title: "Coordinates Placed", description: "Direct coordinates matched!" });
      return;
    }

    // 2. Check for URL
    if (!text.startsWith("http://") && !text.startsWith("https://")) return;
    
    setResolvingLink(true);
    toast({ title: "Resolving Link", description: "Extracting coordinates from Google Maps..." });

    try {
      const res = await fetch(`/api/resolve-maps-url?url=${encodeURIComponent(text)}`);
      const data = await res.json();
      
      if (data.success && data.lat && data.lng) {
        let finalAddr = text;
        if (geocodingLib) {
          const geocoder = new geocodingLib.Geocoder();
          try {
            const geoRes = await geocoder.geocode({ location: { lat: data.lat, lng: data.lng } });
            if (geoRes.results.length > 0) {
              finalAddr = geoRes.results[0].formatted_address;
            }
          } catch (e) {
             console.error("Reverse geocoding failed", e);
          }
        }
        
        onPlaceSelect(data.lat, data.lng, finalAddr);
        setSearchQuery(finalAddr);
        toast({ title: "Success", description: "Coordinates extracted from link!" });
      } else {
        toast({ title: "Failed", description: "Could not find coordinates in that link.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to resolve link.", variant: "destructive" });
    } finally {
      setResolvingLink(false);
    }
  }

  // Intercept pastes
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText.startsWith("http://") || pastedText.startsWith("https://") || /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(pastedText)) {
      e.preventDefault();
      setSearchQuery(pastedText);
      handleSpecialInput(pastedText);
    }
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        {resolvingLink ? (
          <Loader2 className="absolute left-2.5 top-2.5 h-4 w-4 text-blue-500 animate-spin" />
        ) : (
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        )}
        <Input
          ref={inputRef}
          placeholder="Search address, place, or paste Maps link..."
          className="pl-9 text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSpecialInput(searchQuery);
          }}
        />
        {/* Force high z-index for Google Maps Places Autocomplete dropdown */}
        <style dangerouslySetInnerHTML={{ __html: `
          .pac-container {
            z-index: 99999 !important;
          }
        `}} />
      </div>
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

  const [latInput, setLatInput] = useState(initialLat ? String(initialLat) : "")
  const [lngInput, setLngInput] = useState(initialLng ? String(initialLng) : "")

  const [cameraProps, setCameraProps] = useState({
    center: initialLat && initialLng ? { lat: initialLat, lng: initialLng } : DEFAULT_CENTER,
    zoom: initialLat && initialLng ? 16 : DEFAULT_ZOOM
  })

  const updateMarkerAndInputs = (lat: number, lng: number) => {
    setMarkerPos({ lat, lng })
    setLatInput(lat.toFixed(6))
    setLngInput(lng.toFixed(6))
    setCameraProps(prev => ({ ...prev, center: { lat, lng }, zoom: Math.max(prev.zoom, 15) }))
  }

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
        updateMarkerAndInputs(lat, lng)
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
        updateMarkerAndInputs(lat, lng)
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
      updateMarkerAndInputs(lat, lng)
      setAddress(addr)
      onLocationChange({ lat, lng, address: addr })
    },
    [onLocationChange]
  )

  const RADIUS_PRESETS = [50, 100, 150, 200, 300, 500, 1000]

  return (
    <>
      <APIProvider apiKey={MAPS_KEY} libraries={LIBRARIES}>
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
        <div
          className="rounded-lg overflow-hidden border shadow-sm"
          style={{ height }}
        >
          <Map
            {...cameraProps}
            onCameraChanged={(ev) => setCameraProps(ev.detail)}
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
                      updateMarkerAndInputs(lat, lng)
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
              value={latInput}
              onChange={(e) => {
                const val = e.target.value;
                setLatInput(val);
                const parsed = parseFloat(val);
                if (!isNaN(parsed) && parsed >= -90 && parsed <= 90) {
                   setMarkerPos({ lat: parsed, lng: markerPos.lng });
                   setCameraProps(prev => ({ ...prev, center: { lat: parsed, lng: markerPos.lng } }));
                   reverseGeocode(parsed, markerPos.lng);
                }
              }}
              className="bg-gray-50 text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Longitude</Label>
            <Input
              value={lngInput}
              onChange={(e) => {
                const val = e.target.value;
                setLngInput(val);
                const parsed = parseFloat(val);
                if (!isNaN(parsed) && parsed >= -180 && parsed <= 180) {
                   setMarkerPos({ lat: markerPos.lat, lng: parsed });
                   setCameraProps(prev => ({ ...prev, center: { lat: markerPos.lat, lng: parsed } }));
                   reverseGeocode(markerPos.lat, parsed);
                }
              }}
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
      </APIProvider>
    </>
  )
}
