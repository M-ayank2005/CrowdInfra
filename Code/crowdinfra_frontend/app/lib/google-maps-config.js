export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  'AIzaSyCBUWqISO_DOQUKhwb7q09wQteK87WOEec'

export const GOOGLE_MAPS_LIBRARIES = ['places']

export const GOOGLE_MAPS_SCRIPT_ID = 'crowdinfra-google-maps-script'

export const googleMapsScriptOptions = {
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  libraries: GOOGLE_MAPS_LIBRARIES,
  id: GOOGLE_MAPS_SCRIPT_ID,
}

export const hasGoogleMapsApiKey = Boolean(GOOGLE_MAPS_API_KEY)