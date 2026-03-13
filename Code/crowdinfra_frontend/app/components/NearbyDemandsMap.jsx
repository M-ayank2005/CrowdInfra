'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  GoogleMap,
  Marker,
  InfoWindow,
  useLoadScript,
} from '@react-google-maps/api'
import MapPlaceholder from './map-placeholder'
import {
  googleMapsScriptOptions,
  hasGoogleMapsApiKey,
} from '../lib/google-maps-config'

const containerStyle = {
  width: '100%',
  height: '450px',
}

const defaultCenter = { lat: 20.5937, lng: 78.9629 } // Default: India center

export default function NearbyDemandsMap({ onDemandSelect }) {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [demands, setDemands] = useState([])
  const [selectedDemand, setSelectedDemand] = useState(null)
  const [hoveringInfoWindow, setHoveringInfoWindow] = useState(false)
  const [hoveringUserLocation, setHoveringUserLocation] = useState(false)

  // Load Google Maps script
  const { isLoaded, loadError } = useLoadScript(googleMapsScriptOptions)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setLocation(userLocation)
        fetchNearbyDemands(userLocation)
      },
      (err) => {
        setError(`Location access denied: ${err.message}`)
      }
    )
  }, [])

  const fetchNearbyDemands = async (userLocation) => {
    try {
      // console.log('Fetching nearby demands...', userLocation)
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/demand/nearby?latitude=${userLocation.lat}&longitude=${userLocation.lng}&radius=5000`
      )
      // console.log('Nearby demands:', response.data)
      setDemands(response.data)
    } catch (error) {
      console.error('Error fetching demands:', error)
      setError('Failed to load nearby demands.')
    }
  }

  const handleDemandSelect = (demand) => {
    setSelectedDemand(demand)
    onDemandSelect && onDemandSelect(demand)
  }

  if (!hasGoogleMapsApiKey || loadError) {
    return (
      <MapPlaceholder
        title='Map unavailable'
        message='Nearby demands can still be browsed elsewhere, but Google Maps could not be initialized here.'
        loading={false}
        minHeightClass='min-h-[450px]'
      />
    )
  }

  if (!isLoaded) {
    return (
      <MapPlaceholder
        title='Loading map'
        message='Nearby demands will appear as soon as Google Maps is ready.'
        minHeightClass='min-h-[450px]'
      />
    )
  }

  return (
    <div className='relative'>
      {error && (
        <div className='mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100'>
          {error}
        </div>
      )}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={location || defaultCenter}
        zoom={location ? 14 : 5}
      >
        {location && (
          <>
            {/* "You Are Here" Card - Shown on Hover */}
            {hoveringUserLocation && (
              <InfoWindow
                position={location}
                onCloseClick={() => setHoveringUserLocation(false)}
              >
                <div
                  className='bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-lg shadow-lg'
                  onMouseEnter={() => setHoveringUserLocation(true)}
                  onMouseLeave={() => setHoveringUserLocation(false)}
                >
                  <div className='flex items-center mb-2'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-6 w-6 text-blue-600 mr-2'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                      />
                    </svg>
                    <h3 className='text-lg font-bold text-blue-900'>
                      Your Location
                    </h3>
                  </div>

                  <div className='bg-white/50 backdrop-blur-sm rounded-md p-2'>
                    <p className='text-sm text-blue-800 mb-1'>
                      <strong>Latitude:</strong> {location.lat.toFixed(4)}°N
                    </p>
                    <p className='text-sm text-blue-800'>
                      <strong>Longitude:</strong> {location.lng.toFixed(4)}°E
                    </p>
                  </div>

                  <p className='text-xs text-blue-700 mt-2 italic'>
                    Your current precise location
                  </p>
                </div>
              </InfoWindow>
            )}

            {/* Green Marker for Current Location */}
            <Marker
              position={location}
              icon={'https://maps.google.com/mapfiles/ms/icons/green-dot.png'}
              onMouseOver={() => setHoveringUserLocation(true)}
              onMouseOut={() => setHoveringUserLocation(false)}
            />
          </>
        )}

        {/* Rest of the existing code remains the same */}
        {demands.map((demand) => (
          <Marker
            key={demand._id}
            position={{
              lat: demand.location.coordinates[1],
              lng: demand.location.coordinates[0],
            }}
            onMouseOver={() => handleDemandSelect(demand)}
            onMouseOut={() => {
              if (!hoveringInfoWindow) {
                handleDemandSelect(null)
              }
            }}
            icon={'https://maps.google.com/mapfiles/ms/icons/red-dot.png'}
          />
        ))}

        {selectedDemand && (
          <InfoWindow
            position={{
              lat: selectedDemand.location.coordinates[1],
              lng: selectedDemand.location.coordinates[0],
            }}
            onCloseClick={() => {
              handleDemandSelect(null)
              setHoveringInfoWindow(false)
            }}
          >
            <div
              className='bg-white p-3 rounded shadow-lg'
              onMouseEnter={() => setHoveringInfoWindow(true)}
              onMouseLeave={() => {
                setHoveringInfoWindow(false)
                handleDemandSelect(null)
              }}
            >
              <a
                href={`/viewrequest?id=${selectedDemand._id}`}
                className='text-blue-600 hover:underline text-xs mt-2 block'
              >
                <h3 className='text-lg font-bold'>{selectedDemand.title}</h3>
              </a>
              <p className='text-sm text-gray-700 mb-2 leading-relaxed'>
                {selectedDemand.description}
              </p>
              <p className='text-xs text-gray-500 mt-2'>
                <strong>Category:</strong> {selectedDemand.category}
              </p>
              <p className='text-xs text-gray-500'>
                <strong>Upvotes:</strong> {selectedDemand.up_votes} |{' '}
                <strong>Downvotes:</strong> {selectedDemand.down_votes}
              </p>
              <p className='text-xs text-gray-500 mt-2'>
                Click on the title to view details
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  )
}
