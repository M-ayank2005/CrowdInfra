"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { useUserContext } from "./user_context";

const requestFields = ["geometry", "name", "formatted_address", "place_id"];
const DEBOUNCE_MS = 180;

const parsePhotonSuggestions = (data = {}) => {
  const features = Array.isArray(data.features) ? data.features : [];

  return features
    .map((feature, index) => {
      const coordinates = feature?.geometry?.coordinates;
      const properties = feature?.properties || {};

      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return null;
      }

      const lng = Number(coordinates[0]);
      const lat = Number(coordinates[1]);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      const mainText =
        properties.name ||
        properties.city ||
        properties.state ||
        properties.country ||
        "Unknown location";

      const secondaryParts = [
        properties.city,
        properties.state,
        properties.country,
      ].filter(Boolean);

      return {
        id: `photon-${feature.properties?.osm_id || index}`,
        mainText,
        secondaryText: secondaryParts.join(", "),
        description: [mainText, ...secondaryParts].filter(Boolean).join(", "),
        lat,
        lng,
        source: "photon",
      };
    })
    .filter(Boolean);
};

const PlaceAutocomplete = ({
  onPlaceSelect,
  placeholder = "Search for a location...",
  className = "",
}) => {
  const userContext = useUserContext() || {};
  const {
    handlePlaceSelect: contextHandlePlaceSelect,
    selectedPlace,
    setSelectedPlace,
  } = userContext;
  const containerRef = useRef(null);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isMapsReady, setIsMapsReady] = useState(false);

  const handleResolvedPlaceSelect = onPlaceSelect || contextHandlePlaceSelect;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let timeoutId;

    const initializePlacesServices = () => {
      if (!window.google?.maps?.places) {
        timeoutId = window.setTimeout(initializePlacesServices, 200);
        return;
      }

      autocompleteServiceRef.current =
        new window.google.maps.places.AutocompleteService();
      placesServiceRef.current = new window.google.maps.places.PlacesService(
        document.createElement("div")
      );

      setIsMapsReady(true);
    };

    initializePlacesServices();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedPlace?.name) {
      setQuery(selectedPlace.name);
    }
  }, [selectedPlace]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setIsLoading(true);

    const fetchFallbackSuggestions = async () => {
      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(
            trimmedQuery
          )}&limit=6`
        );

        if (!response.ok) {
          throw new Error(`Photon search failed: ${response.status}`);
        }

        const payload = await response.json();
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const fallbackSuggestions = parsePhotonSuggestions(payload);
        setSuggestions(fallbackSuggestions);
        setIsOpen(fallbackSuggestions.length > 0);
        setIsLoading(false);
        setActiveIndex(-1);
      } catch (error) {
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
      }
    };

    const debounceId = window.setTimeout(() => {
      if (!autocompleteServiceRef.current || !window.google?.maps?.places) {
        fetchFallbackSuggestions();
        return;
      }

      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: trimmedQuery,
          types: ["geocode"],
        },
        (predictions = [], status) => {
          if (currentRequestId !== requestIdRef.current) {
            return;
          }

          const serviceStatus = window.google.maps.places.PlacesServiceStatus;
          const isSuccess = status === serviceStatus.OK && predictions.length > 0;

          if (isSuccess) {
            setSuggestions(
              predictions.map((prediction) => ({
                id: prediction.place_id,
                mainText:
                  prediction.structured_formatting?.main_text ||
                  prediction.description,
                secondaryText:
                  prediction.structured_formatting?.secondary_text || "",
                description: prediction.description,
                placeId: prediction.place_id,
                source: "google",
              }))
            );
            setIsOpen(true);
            setIsLoading(false);
            setActiveIndex(-1);
            return;
          }

          fetchFallbackSuggestions();
        }
      );
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceId);
    };
  }, [query]);

  const selectSuggestion = (suggestion) => {
    if (!suggestion || !handleResolvedPlaceSelect) {
      return;
    }

    setQuery(suggestion.description || suggestion.mainText || "");
    setIsOpen(false);
    setSuggestions([]);
    setIsLoading(false);

    if (suggestion.source === "photon") {
      handleResolvedPlaceSelect({
        lat: suggestion.lat,
        lng: suggestion.lng,
        name: suggestion.mainText,
        formattedAddress: suggestion.description,
        bounds: null,
        zoom: 14,
      });
      return;
    }

    if (!placesServiceRef.current || !suggestion.placeId || !window.google?.maps?.places) {
      return;
    }

    setIsLoading(true);

    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.placeId,
        fields: requestFields,
      },
      (place, status) => {
        setIsLoading(false);

        if (
          status === window.google.maps.places.PlacesServiceStatus.OK &&
          place
        ) {
          handleResolvedPlaceSelect(place);
          setQuery(place.formatted_address || place.name || suggestion.description);
        }
      }
    );
  };

  const handleKeyDown = (event) => {
    if (!suggestions.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      );
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex >= 0 ? activeIndex : 0]);
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 shadow-lg backdrop-blur-md transition-colors focus-within:border-blue-400/70">
        <Search className="h-4 w-4 text-blue-300" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400 sm:text-base"
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              setIsOpen(false);
              setActiveIndex(-1);
              setSelectedPlace?.(null);
            }}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Clear location search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : !isMapsReady ? (
          <span className="text-xs text-slate-400">Loading maps...</span>
        ) : null}
      </div>

      {isOpen && (suggestions.length > 0 || isLoading) ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-md">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-300">Searching locations...</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-2 scrollbar-hide">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onClick={() => selectSuggestion(suggestion)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      activeIndex === index
                        ? "bg-blue-500/15 text-white"
                        : "text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {suggestion.mainText}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {suggestion.secondaryText || suggestion.description}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default PlaceAutocomplete;
