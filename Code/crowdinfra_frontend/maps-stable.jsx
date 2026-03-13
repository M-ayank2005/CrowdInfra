"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  APIProvider,
  ControlPosition,
  MapControl,
  AdvancedMarker,
  Map,
  useMap,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import PlaceAutocomplete from "./app/components/autocomplete";
import { GOOGLE_MAPS_API_KEY } from "./app/lib/google-maps-config";

const MapHandler = ({ place, marker }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !place || !marker) return;

    if (place.geometry?.viewport) {
      map.fitBounds(place.geometry?.viewport);
    }

    marker.position = place.geometry?.location;
  }, [map, place, marker]);

  return null;
};
const LogScaleValue = () => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const logScale = () => {
      const projection = map.getProjection();
      if (!projection) return;

      const center = map.getCenter();
      if (!center) return;

      // Get scale value in meters per pixel
      const zoom = map.getZoom();
      const scale =
        (156543.03392 * Math.cos((center.lat() * Math.PI) / 180)) /
        Math.pow(2, zoom);

      console.log("Scale Control Enabled:", map.get("scaleControl"));
      console.log("Zoom Level:", zoom);
      console.log("Scale (meters per pixel):", scale);
    };

    logScale(); // Initial log
    const intervalId = setInterval(logScale, 5000);

    return () => clearInterval(intervalId);
  }, [map]);

  return null;
};

const ClickLogger = () => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleClick = (event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      console.log(`Clicked at: Latitude: ${lat}, Longitude: ${lng}`);
    };

    map.addListener("click", handleClick);

    return () => {
      google.maps.event.clearListeners(map, "click");
    };
  }, [map]);

  return null;
};

export default function Gmaps() {
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <div className="h-full w-full">
      <APIProvider
        apiKey={GOOGLE_MAPS_API_KEY}
        libraries={["places"]}
        solutionChannel="GMP_devsite_samples_v3_rgmautocomplete"
      >
        <Map
          mapId={"bf51a910020fa25a"}
          defaultZoom={3}
          defaultCenter={{ lat: 22.54992, lng: 0 }}
          gestureHandling={"greedy"}
          disableDefaultUI={true}
          className="w-full h-full"
          mapTypeId="satellite"
          scaleControl="true"
        >
          <LogScaleValue />
          <ClickLogger /> 
          <AdvancedMarker ref={markerRef} position={null} />
          <MapControl position={ControlPosition.TOP}>
            <div className="m-4 w-96 max-w-[calc(100vw-2rem)]">
              <PlaceAutocomplete onPlaceSelect={setSelectedPlace} />
            </div>
          </MapControl>
          <MapHandler place={selectedPlace} marker={marker} />
        </Map>
      </APIProvider>
    </div>
  );
}
