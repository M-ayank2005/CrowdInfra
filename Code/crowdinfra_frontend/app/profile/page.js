/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useEffect } from 'react'
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api'
import Navbar from '../components/navbar'
import axios from 'axios'
import { Edit, Phone, MapPin, Calendar, Mail, User, Clock } from 'lucide-react'
import Image from 'next/image'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import MapPlaceholder from '../components/map-placeholder'
import {
  googleMapsScriptOptions,
  hasGoogleMapsApiKey,
} from '../lib/google-maps-config'

const containerStyle = {
  width: '100%',
  height: '250px',
}

const ProfilePage = () => {
  const [user, setUser] = useState(null)
  const [mapCenter, setMapCenter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('info')
  const router = useRouter()

  const { isLoaded, loadError } = useLoadScript(googleMapsScriptOptions)

  const handleLogout = async () => {
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/logout`,
        {},
        { withCredentials: true }
      ) // ✅ Sends request to clear cookie
      router.push('/auth') // ✅ Redirect to login page
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/profile`,
          {
            withCredentials: true,
          }
        )

        if (response.status !== 200) {
          throw new Error('Failed to fetch user data')
        }

        setUser(response.data)

        // Improved geocoding logic
        if (response.data?.address && isLoaded) {
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode(
            { address: response.data.address },
            (results, status) => {
              if (status === 'OK' && results[0]) {
                const { lat, lng } = results[0].geometry.location
                setMapCenter({
                  lat: lat(),
                  lng: lng(),
                })
              } else {
                // Fallback to a default location if geocoding fails
                setMapCenter({ lat: 28.6139, lng: 77.209 })
                console.warn('Geocoding failed, using default location')
              }
            }
          )
        } else if (response.data?.location) {
          // Ensure location is in the correct format
          setMapCenter(response.data.location)
        } else {
          // Default location if no address or location is provided
          setMapCenter({ lat: 28.6139, lng: 77.209 })
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
        setError(err.message || 'Failed to load profile data')
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [isLoaded])

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center'>
        <div className='bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 flex flex-col items-center shadow-lg border border-gray-700/50'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4'></div>
          <p className='text-white text-lg'>Loading your profile...</p>
        </div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className='min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center'>
        <div className='bg-gray-800/50 backdrop-blur-lg rounded-xl p-8 flex flex-col items-center shadow-lg border border-gray-700/50 max-w-md'>
          <div className='bg-red-500/20 p-3 rounded-full mb-4'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-6 w-6 text-red-500'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
          </div>
          <h2 className='text-white text-xl font-semibold mb-2'>
            Error Loading Profile
          </h2>
          <p className='text-gray-300 text-center mb-4'>{error}</p>
          <button
            onClick={() => (window.location.href = '/auth')}
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className='min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 py-5 text-white'>
      <Navbar />

      <div className='container mx-auto px-4 py-8'>
        <div className='max-w-4xl mx-auto'>
          <div className='bg-gray-800/50 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-700/50'>
            {/* Header Section with Cover Image */}
            <div className='relative h-48 bg-gradient-to-r from-gray-900 to-black'>
              <div className='absolute -bottom-16 left-8'>
                <div className='h-32 w-32 rounded-full border-4 border-gray-800 overflow-hidden shadow-xl hover:border-blue-500 transition-all duration-300 group'>
                  {console.log(user.profile_image)}
                  <Image
                    src={
                      user.profile_image
                        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}${user.profile_image}`
                        : '/default-avatar.png'
                    }
                    alt={user.name || 'User Profile'}
                    width={150}
                    height={150}
                    unoptimized={true}
                    className='h-full w-full object-cover'
                  />
                </div>
              </div>
            </div>

            {/* Profile Info */}
            <div className='pt-20 px-8 pb-8'>
              <div className='flex flex-col md:flex-row md:justify-between md:items-center'>
                <div>
                  <h1 className='text-3xl font-bold text-white mb-1'>
                    {user.name}
                  </h1>
                  <div className='flex items-center text-blue-400'>
                    <Mail className='h-4 w-4 mr-2' />
                    <span>{user.email}</span>
                  </div>
                </div>
                <button
                  className='flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
             bg-red-500 text-white hover:bg-red-600 active:scale-95 
             transition-all duration-300 shadow-md'
                  onClick={handleLogout}
                >
                  <LogOut size={16} /> <span>Logout</span>
                </button>
              </div>

              {/* Tab Navigation */}
              <div className='flex border-b border-gray-700 mt-8'>
                <button
                  className={`px-4 py-2 font-medium ${
                    activeTab === 'info'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setActiveTab('info')}
                >
                  Personal Info
                </button>
                <button
                  className={`px-4 py-2 font-medium ${
                    activeTab === 'activity'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setActiveTab('activity')}
                >
                  Activity
                </button>
                <button
                  className={`px-4 py-2 font-medium ${
                    activeTab === 'properties'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setActiveTab('properties')}
                >
                  Properties
                </button>
              </div>

              {/* Content based on active tab */}
              <div className='mt-6'>
                {activeTab === 'info' && (
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                    <div>
                      <h2 className='text-xl font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2'>
                        Personal Information
                      </h2>

                      <div className='space-y-6'>
                        <div className='flex items-start'>
                          <div className='text-blue-400 mr-3'>
                            <User className='h-5 w-5' />
                          </div>
                          <div>
                            <p className='text-gray-400 text-sm'>Gender</p>
                            <p className='text-white'>{user.gender}</p>
                          </div>
                        </div>

                        <div className='flex items-start'>
                          <div className='text-blue-400 mr-3'>
                            <Calendar className='h-5 w-5' />
                          </div>
                          <div>
                            <p className='text-gray-400 text-sm'>Age</p>
                            <p className='text-white'>{user.age} years</p>
                          </div>
                        </div>

                        <div className='flex items-start'>
                          <div className='text-blue-400 mr-3'>
                            <Phone className='h-5 w-5' />
                          </div>
                          <div>
                            <p className='text-gray-400 text-sm'>
                              Phone Number
                            </p>
                            <p className='text-white'>{user.phone}</p>
                          </div>
                        </div>

                        <div className='flex items-start'>
                          <div className='text-blue-400 mr-3'>
                            <Clock className='h-5 w-5' />
                          </div>
                          <div>
                            <p className='text-gray-400 text-sm'>
                              Member Since
                            </p>
                            <p className='text-white'>
                              {user.joinDate || 'January 2023'}
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>

                    <div>
                      <h2 className='text-xl font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2'>
                        Location
                      </h2>

                      <div className='flex items-start mb-4'>
                        <div className='text-blue-400 mr-3'>
                          <MapPin className='h-5 w-5' />
                        </div>
                        <div>
                          <p className='text-gray-400 text-sm'>Address</p>
                          <p className='text-white'>{user.address}</p>
                        </div>
                      </div>

                      <div className='rounded-xl overflow-hidden shadow-lg border border-gray-700 hover:border-blue-500/50 transition-colors duration-300'>
                        {!hasGoogleMapsApiKey || loadError ? (
                          <MapPlaceholder
                            title='Map unavailable'
                            message='Your profile data is loaded, but the location preview could not be initialized.'
                            loading={false}
                            minHeightClass='min-h-[250px]'
                          />
                        ) : isLoaded && mapCenter ? (
                          <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={mapCenter} // Use mapCenter state
                            zoom={14}
                            options={{
                              mapTypeControl: false,
                              streetViewControl: false,
                              fullscreenControl: false,
                              zoomControl: true,
                              styles: [
                                {
                                  featureType: 'all',
                                  elementType: 'all',
                                  stylers: [{ saturation: -70 }],
                                },
                              ],
                            }}
                          >
                            <Marker position={mapCenter} />
                          </GoogleMap>
                        ) : (
                          <MapPlaceholder
                            title='Loading map'
                            message='Your profile details are ready while the location preview loads.'
                            minHeightClass='min-h-[250px]'
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div>
                    <h2 className='text-xl font-semibold mb-4 text-gray-200 border-b border-gray-700 pb-2'>
                      Recent Activity
                    </h2>
                    <div className='space-y-4'>
                      {(
                        user.recentActivity || [
                          {
                            action: 'Viewed property',
                            description: '3 BHK Apartment in Sector 45',
                            timestamp: '2 days ago',
                          },
                          {
                            action: 'Created request',
                            description: 'Looking for commercial space',
                            timestamp: '1 week ago',
                          },
                          {
                            action: 'Updated profile',
                            description: 'Changed contact information',
                            timestamp: '2 weeks ago',
                          },
                        ]
                      ).map((activity, index) => (
                        <div
                          key={index}
                          className='bg-gray-700/30 p-4 rounded-lg border-l-4 border-blue-500 hover:bg-gray-700/50 transition-colors'
                        >
                          <div className='flex justify-between'>
                            <p className='font-medium text-blue-400'>
                              {activity.action}
                            </p>
                            <p className='text-gray-400 text-sm'>
                              {activity.timestamp}
                            </p>
                          </div>
                          <p className='text-gray-300 mt-1'>
                            {activity.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'properties' && (
                  <div>
                    <div className='flex justify-between items-center mb-4'>
                      <h2 className='text-xl font-semibold text-gray-200'>
                        Your Properties
                      </h2>
                      <button className='px-4 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm'>
                        Add New
                      </button>
                    </div>

                    {user.properties > 0 ? (
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        {[
                          {
                            title: 'Luxury Villa',
                            location: 'Beverly Hills, CA',
                            price: '$2,500,000',
                            image:
                              'https://source.unsplash.com/400x300/?luxury,villa',
                          },
                          {
                            title: 'Modern Apartment',
                            location: 'New York City, NY',
                            price: '$1,200,000',
                            image:
                              'https://source.unsplash.com/400x300/?apartment,modern',
                          },
                          {
                            title: 'Beachfront Condo',
                            location: 'Miami, FL',
                            price: '$900,000',
                            image:
                              'https://source.unsplash.com/400x300/?beach,condo',
                          },
                        ].map((property, index) => (
                          <div
                            key={index}
                            className='bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300'
                          >
                            <img
                              src={property.image}
                              alt={property.title}
                              className='w-full h-48 object-cover'
                            />
                            <div className='p-4'>
                              <h3 className='text-lg font-semibold text-white'>
                                {property.title}
                              </h3>
                              <p className='text-gray-400'>
                                {property.location}
                              </p>
                              <p className='text-blue-400 font-medium mt-2'>
                                {property.price}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className='text-gray-400'>No properties listed yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
