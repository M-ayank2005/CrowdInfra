'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

import {
  useLoadScript,
  GoogleMap,
  Marker,
  InfoWindow,
} from '@react-google-maps/api'

import Navbar from '../components/navbar'

import { useUserContext } from '../components/user_context'

import PlaceAutocomplete from '../components/autocomplete'

import { X, MapPin } from 'lucide-react'

import Footer from '../components/footer'
import MapPlaceholder from '../components/map-placeholder'
import {
  googleMapsScriptOptions,
  hasGoogleMapsApiKey,
} from '../lib/google-maps-config'
import { focusMapOnSelectedPlace } from '../lib/focus-map-on-place'

const containerStyle = {
  width: '100%',

  height: '70vh',
}

const center = {
  lat: 20.5937,

  lng: 78.9629,
}

const PropertyPage = () => {
  const [showSteps, setShowSteps] = useState(true)

  const [selectedLocation, setSelectedLocation] = useState(null)

  const [showLocationPopup, setShowLocationPopup] = useState(false)

  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    title: '',

    description: '',

    category: 'residential',

    price: '',

    type: 'sell',

    area: '',

    contactNumber: '',

    status: 'available',
  })

  const [submittedProperties, setSubmittedProperties] = useState([])

  const [activeProperty, setActiveProperty] = useState(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const mapRef = useRef(null)

  const { selectedPlace } = useUserContext() || {}

  const { isLoaded, loadError } = useLoadScript(googleMapsScriptOptions)

  useEffect(() => {
    if (selectedPlace && selectedPlace.lat && selectedPlace.lng) {
      const nextLocation = {
        lat: selectedPlace.lat,

        lng: selectedPlace.lng,
      }

      setSelectedLocation(nextLocation)
      focusMapOnSelectedPlace(mapRef.current, selectedPlace)
    }
  }, [selectedPlace])

  const handleMapClick = useCallback((event) => {
    if (event && event.latLng) {
      try {
        const lat = event.latLng.lat()

        const lng = event.latLng.lng()

        if (typeof lat === 'number' && typeof lng === 'number') {
          setSelectedLocation({ lat, lng })

          setShowLocationPopup(true)

          setShowForm(false)
        }
      } catch (error) {
        console.error('Error in map click handling:', error)
      }
    }
  }, [])

  const handleCloseLocationPopup = () => {
    setShowLocationPopup(false)

    setSelectedLocation(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedLocation || !selectedLocation.lat || !selectedLocation.lng) {
      alert('Please select a location on the map')

      return
    }

    setIsSubmitting(true)

    try {
      const propertyData = {
        ...formData,

        location: {
          type: 'Point',

          coordinates: [selectedLocation.lng, selectedLocation.lat],
        },
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/property/property`,

        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify(propertyData),
        }
      )

      const data = await response.json()

      if (response.ok) {
        const newProperty = {
          ...propertyData,

          id: data.property._id,

          coordinates: propertyData.location.coordinates,
        }

        setSubmittedProperties((prev) => [...prev, newProperty])

        // Reset form and show location marker

        setFormData({
          title: '',

          description: '',

          category: 'residential',

          price: '',

          type: 'sell',

          area: '',

          contactNumber: '',

          status: 'available',
        })

        setShowForm(false)

        setShowLocationPopup(false)

        setActiveProperty(newProperty.id)
      } else {
        alert(`Error: ${data.error || 'Failed to submit property'}`)
      }
    } catch (error) {
      console.error('Error submitting property:', error)

      alert('Failed to submit property. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const mapContent = !hasGoogleMapsApiKey || loadError ? (
    <MapPlaceholder
      title='Map unavailable'
      message='The property form is still available, but Google Maps could not be initialized.'
      loading={false}
      minHeightClass='min-h-[70vh]'
    />
  ) : !isLoaded ? (
    <MapPlaceholder
      title='Loading map'
      message='The property form stays available while the map loads.'
      minHeightClass='min-h-[70vh]'
    />
  ) : (
    <GoogleMap
      onLoad={(map) => {
        mapRef.current = map
        focusMapOnSelectedPlace(map, selectedPlace)
      }}
      mapContainerStyle={containerStyle}
      center={selectedLocation || center}
      zoom={selectedLocation ? 15 : 5}
      onClick={handleMapClick}
      options={{
        mapTypeControl: true,

        mapTypeId: 'terrain',

        fullscreenControl: true,

        streetViewControl: true,

        zoomControl: true,
      }}
    >
      {selectedLocation && showLocationPopup && (
        <InfoWindow
          position={selectedLocation}
          onCloseClick={handleCloseLocationPopup}
        >
          <div className='p-4 bg-white rounded-lg shadow-xl'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-xl font-bold text-gray-800'>
                Raise a Property
              </h3>

              {/* <button
                onClick={handleCloseLocationPopup}
                className='text-gray-500 hover:text-gray-700'
              >
                <X size={24} />
              </button> */}
            </div>

            <button
              onClick={() => {
                setShowForm(true)

                setShowLocationPopup(false)
              }}
              className='w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center'
            >
              <MapPin className='mr-2' /> Raise Property Here
            </button>
          </div>
        </InfoWindow>
      )}

      {selectedLocation && !showForm && (
        <Marker
          position={selectedLocation}
          draggable={true}
          onDragEnd={(e) => {
            if (e && e.latLng) {
              try {
                const lat = e.latLng.lat()

                const lng = e.latLng.lng()

                if (
                  typeof lat === 'number' &&
                  typeof lng === 'number'
                ) {
                  setSelectedLocation({ lat, lng })

                  setShowLocationPopup(true)
                }
              } catch (error) {
                console.error('Error in marker drag:', error)
              }
            }
          }}
        />
      )}

      {submittedProperties.map((property) => (
        <Marker
          key={property.id}
          position={{
            lat: property.coordinates[1],

            lng: property.coordinates[0],
          }}
          onClick={() =>
            setActiveProperty(
              activeProperty === property.id ? null : property.id
            )
          }
        >
          {activeProperty === property.id && (
            <InfoWindow
              position={{
                lat: property.coordinates[1],

                lng: property.coordinates[0],
              }}
              onCloseClick={() => {
                setActiveProperty(null)
              }}
            >
              <div className='p-4 max-w-xs'>
                <h3 className='text-xl font-bold text-blue-600 mb-2'>
                  {property.title}
                </h3>

                <p className='text-gray-700 mb-2'>{property.description}</p>

                <div className='flex justify-between'>
                  <span className='bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'>
                    {property.category}
                  </span>

                  <span className='text-green-600 font-semibold'>
                    ₹{property.price}
                  </span>
                </div>
              </div>
            </InfoWindow>
          )}
        </Marker>
      ))}
    </GoogleMap>
  )

  return (
    <>
      <div className='min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 py-10 text-gray-100'>
        <Navbar />

        <div className='container mx-auto px-4 py-8 mt-8'>
          <h1 className='text-4xl font-bold mb-8 text-center mt-8'>
            Raise Property
          </h1>

          <div className='mb-6 flex items-center justify-center'>
            <div className='w-full md:w-2/3 lg:w-1/2'>
              <PlaceAutocomplete />
            </div>
          </div>

          {/* Main Content with Side-by-Side Layout */}

          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {/* Steps Section - Left Column */}

            <div className='md:col-span-1 bg-gray-800/50 rounded-xl p-6 border border-gray-700 h-fit'>
              <div
                className='flex items-center justify-between cursor-pointer'
                onClick={() => setShowSteps(!showSteps)}
              >
                <h2 className='text-2xl font-semibold flex items-center'>
                  How to Raise a Property
                </h2>

                <button className='text-blue-300 hover:text-blue-100'>
                  {showSteps ? 'Hide Steps' : 'Show Steps'}
                </button>
              </div>

              {showSteps && (
                <div className='mt-4 space-y-4 text-gray-300'>
                  <div className='flex items-start'>
                    <span className='mr-3 text-blue-400 font-bold text-lg'>
                      1.
                    </span>

                    <p>
                      Use the search bar or click directly on the map to select
                      your property location.
                    </p>
                  </div>

                  <div className='flex items-start'>
                    <span className='mr-3 text-blue-400 font-bold text-lg'>
                      2.
                    </span>

                    <p>
                      An info window will appear. Click "Raise Property Here" to
                      open the property details form.
                    </p>
                  </div>

                  <div className='flex items-start'>
                    <span className='mr-3 text-blue-400 font-bold text-lg'>
                      3.
                    </span>

                    <p>
                      Fill in all the required details about your property,
                      including title, category, type, price, and contact
                      information.
                    </p>
                  </div>

                  <div className='flex items-start'>
                    <span className='mr-3 text-blue-400 font-bold text-lg'>
                      4.
                    </span>

                    <p>
                      Review your information and submit. Your property will be
                      displayed on the map for others to view.
                    </p>
                  </div>

                  <div className='mt-4 bg-blue-900/30 p-3 rounded-lg border border-blue-800/50 text-blue-200'>
                    <p>
                      💡 Pro Tip: You can drag the marker to adjust the exact
                      location of your property.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Map Section - Right Columns */}

            <div className='md:col-span-2 rounded-xl overflow-hidden shadow-2xl relative'>
              {mapContent}
            </div>
          </div>

          {/* Form Overlay */}

          {showForm && (
            <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
              <div className='relative w-full max-w-2xl'>
                <button
                  onClick={() => {
                    setShowForm(false)

                    setShowLocationPopup(true)
                  }}
                  className='absolute -top-10 right-0 text-white hover:text-gray-300'
                >
                  <X size={30} />
                </button>

                <form
                  onSubmit={handleSubmit}
                  className='bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/20'
                >
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div>
                      <label className='block text-lg font-medium text-gray-200 mb-2'>
                        Property Title
                      </label>

                      <input
                        type='text'
                        className='w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300'
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className='block text-lg font-medium text-gray-200 mb-2'>
                        Category
                      </label>

                      <select
                        className='w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300'
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                      >
                        <option value='residential'>Residential</option>

                        <option value='commercial'>Commercial</option>

                        <option value='industrial'>Industrial</option>

                        <option value='land'>Land</option>
                      </select>
                    </div>

                    <div>
                      <label className='block text-lg font-medium text-gray-200 mb-2'>
                        Type
                      </label>

                      <select
                        className='w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300'
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                      >
                        <option value='sell'>Sell</option>

                        <option value='rent'>Rent</option>

                        <option value='lease'>Lease</option>
                      </select>
                    </div>

                    <div>
                      <label className='block text-lg font-medium text-gray-200 mb-2'>
                        Price (₹)
                      </label>

                      <input
                        type='number'
                        className='w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300'
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({ ...formData, price: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className='block text-lg font-medium text-gray-200 mb-2'>
                        Area (sq ft)
                      </label>

                      <input
                        type='number'
                        className='w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300'
                        value={formData.area}
                        onChange={(e) =>
                          setFormData({ ...formData, area: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className='block text-lg font-medium text-gray-200 mb-2'>
                        Contact Number
                      </label>

                      <input
                        type='tel'
                        className='w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300'
                        value={formData.contactNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,

                            contactNumber: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className='md:col-span-2'>
                      <label className='block text-lg font-medium text-gray-200 mb-2'>
                        Description
                      </label>

                      <textarea
                        className='w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300'
                        rows='4'
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,

                            description: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className='flex justify-center mt-8'>
                    <button
                      type='submit'
                      className='px-10 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 flex items-center justify-center'
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className='animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2'></div>
                          Submitting...
                        </>
                      ) : (
                        'Submit Property'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}

export default PropertyPage
