'use client'
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

const UserContext = createContext()

const normalizeSelectedPlace = (place) => {
  if (!place) {
    return null
  }

  if (typeof place.lat === 'number' && typeof place.lng === 'number') {
    return {
      lat: place.lat,
      lng: place.lng,
      name: place.name || place.formattedAddress || place.formatted_address || '',
      placeId: place.placeId || place.place_id || null,
      bounds: place.bounds || null,
      zoom: place.zoom || 15,
    }
  }

  const location = place.geometry?.location
  if (!location) {
    return null
  }

  const viewport = place.geometry?.viewport

  return {
    lat: location.lat(),
    lng: location.lng(),
    name: place.formatted_address || place.name || '',
    placeId: place.place_id || null,
    bounds: viewport
      ? {
          north: viewport.getNorthEast().lat(),
          east: viewport.getNorthEast().lng(),
          south: viewport.getSouthWest().lat(),
          west: viewport.getSouthWest().lng(),
        }
      : null,
    zoom: 15,
  }
}

export const UserProvider = ({ children }) => {
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [demandLocations, setDemandLocations] = useState([])
  const [overlayOn, setOverlayOn] = useState(false)
  const [imageBlob, setImageBlob] = useState(null)
  const [scaleVal, setScaleVal] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [activeDemand, setActiveDemand] = useState(null)
  const [user, setUser] = useState(null) // Track logged-in user
  const router = useRouter()

  // Verify user authentication
  useEffect(() => {
    const verifyUser = async () => {
      const token = Cookies.get('crowdInfra_token') // Get token from cookies
      if (!token) {
        // router.push('/landing') // Redirect if token is missing
        return
      }

      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/verify`,
          {
            withCredentials: true, // Ensure cookies are sent
          }
        )

        if (response.data.valid) {
          setUser(response.data.user) // Store user data
        } else {
          // router.push('/landing') // Redirect if invalid token
        }
      } catch (error) {
        // router.push('/landing') // Redirect on error
      }
    }

    verifyUser()
  }, [router])

  // Logout function
  const logout = () => {
    Cookies.remove('crowdInfra_token') // Remove token
    setUser(null) // Clear user state
    // router.push('/landing') // Redirect to login page
  }

  const handlePlaceSelect = useCallback((place) => {
    const normalizedPlace = normalizeSelectedPlace(place)

    if (normalizedPlace) {
      setSelectedPlace(normalizedPlace)
      setActiveDemand(null)
    }
  }, [])

  const handleMapClick = useCallback((event) => {
    if (event?.latLng) {
      setSelectedPlace({
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
        name: 'Pinned Location',
        placeId: null,
        bounds: null,
        zoom: 15,
      })
      setActiveDemand(null)
    }
  }, [])

  const highlightDemand = useCallback(
    (demandId) => {
      const demand = demandLocations.find((d) => d.id === demandId)
      if (demand) {
        setActiveDemand(demand)
        setSelectedPlace(null)
      }
    },
    [demandLocations]
  )

  const value = useMemo(
    () => ({
      user,
      logout,
      selectedPlace,
      setSelectedPlace,
      demandLocations,
      setDemandLocations,
      overlayOn,
      setOverlayOn,
      imageBlob,
      setImageBlob,
      scaleVal,
      setScaleVal,
      searchResults,
      activeDemand,
      handlePlaceSelect,
      handleMapClick,
      raiseDemand: (demandDetails) => {
        if (selectedPlace) {
          setDemandLocations((prev) => [
            ...prev,
            {
              id: Date.now(),
              ...demandDetails,
              location: selectedPlace,
              status: 'active',
            },
          ])
          setSelectedPlace(null)
        }
      },
      loadDemandMarkers: setDemandLocations,
      highlightDemand,
    }),
    [
      user,
      logout,
      selectedPlace,
      demandLocations,
      overlayOn,
      imageBlob,
      scaleVal,
      searchResults,
      activeDemand,
      handlePlaceSelect,
      handleMapClick,
      highlightDemand,
    ]
  )

  return (
    <UserContext.Provider value={value}>{children}</UserContext.Provider>
  )
}

export const useUserContext = () => useContext(UserContext)
