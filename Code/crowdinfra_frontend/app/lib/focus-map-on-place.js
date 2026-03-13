export function focusMapOnSelectedPlace(map, selectedPlace) {
  if (
    !map ||
    !selectedPlace?.lat ||
    !selectedPlace?.lng ||
    typeof window === 'undefined' ||
    !window.google?.maps
  ) {
    return
  }

  if (selectedPlace.bounds) {
    const bounds = new window.google.maps.LatLngBounds(
      {
        lat: selectedPlace.bounds.south,
        lng: selectedPlace.bounds.west,
      },
      {
        lat: selectedPlace.bounds.north,
        lng: selectedPlace.bounds.east,
      }
    )

    map.fitBounds(bounds)

    window.google.maps.event.addListenerOnce(map, 'idle', () => {
      const maxZoom = selectedPlace.zoom || 16
      if (map.getZoom() > maxZoom) {
        map.setZoom(maxZoom)
      }
    })
    return
  }

  map.panTo({ lat: selectedPlace.lat, lng: selectedPlace.lng })
  map.setZoom(selectedPlace.zoom || 15)
}