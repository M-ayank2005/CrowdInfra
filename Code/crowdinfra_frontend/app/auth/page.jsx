'use client'

import { useState, useRef } from 'react'
import Login from '../components/login'
import SignupPage from '../components/signup'
import RotatingEarth from '../components/RotatingEarth'
import { Camera, Upload } from 'lucide-react'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(false)
  const [isSceneReady, setIsSceneReady] = useState(false)
  const fileInputRef = useRef(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null)
  const [profilePhoto, setProfilePhoto] = useState(null)

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setProfilePhoto(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className='flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-gradient-to-b from-black via-blue-950 to-black px-0 sm:px-4 lg:px-6'>
      <div className='relative flex h-full w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-black/30 shadow-2xl backdrop-blur-sm sm:max-h-[calc(100dvh-2rem)] sm:rounded-[2rem] lg:flex-row'>
        {/* Earth Animation Section */}
        <div
          className={`relative flex min-h-[240px] flex-[0_0_auto] items-center justify-center overflow-hidden px-4 py-6 transition-all duration-700 ease-in-out sm:min-h-[280px] sm:px-8 lg:min-h-0 lg:flex-1 lg:px-10 ${
            isLogin ? 'lg:order-last' : ''
          }`}
        >
          {!isSceneReady && (
            <div className='absolute inset-0 z-20 flex items-center justify-center bg-black'>
              <div className='w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
            </div>
          )}

          <div
            className={`absolute inset-0 transition-opacity duration-1000 ${
              isSceneReady ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <RotatingEarth
              onReady={() => setIsSceneReady(true)}
              onError={() => setIsSceneReady(true)}
            />
          </div>

          <div className='relative z-10 max-w-md px-4 text-center sm:px-8'>
            <div className='text-xl text-gray-200 drop-shadow-md sm:text-2xl'>
              {isLogin ? (
                'Your journey continues here'
              ) : (
                <div className='mb-8 flex flex-col items-center'>
                  <div
                    className='relative w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-gray-700 border-4 border-gray-600 mb-4 cursor-pointer'
                    onClick={triggerFileInput}
                  >
                    {profilePhotoPreview ? (
                      <img
                        src={profilePhotoPreview}
                        alt='Profile preview'
                        className='w-full h-full object-cover'
                      />
                    ) : (
                      <div className='flex items-center justify-center h-full'>
                        <Camera className='w-8 h-8 sm:w-10 sm:h-10 text-gray-400' />
                      </div>
                    )}
                    <div
                      className='absolute bottom-0 right-0 bg-blue-600 rounded-full p-1 cursor-pointer'
                      onClick={triggerFileInput}
                    >
                      <Upload className='w-3 h-3 sm:w-4 sm:h-4' />
                    </div>
                  </div>
                  <input
                    type='file'
                    ref={fileInputRef}
                    onChange={handlePhotoChange}
                    accept='image/*'
                    className='hidden'
                  />
                  <p className='text-gray-300 text-xs sm:text-sm'>
                    Upload profile photo
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className='absolute inset-0 bg-gradient-to-r from-blue-900/40 to-black/70 z-0'></div>
        </div>

        {/* Form Section */}
        <div className='scrollbar-hide flex flex-1 flex-col justify-center overflow-y-auto bg-gray-950/80 p-5 sm:p-6 md:p-8 lg:p-10'>
          <div className='mx-auto w-full max-w-xl'>
            <div className='mb-6 md:mb-8'>
              <h2 className='text-2xl md:text-3xl font-bold text-center text-white dark:text-white'>
                {isLogin ? 'Log In' : 'Create Account'}
              </h2>
              <div className='h-1 w-16 md:w-20 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto mt-2 rounded-full'></div>
            </div>

            {isLogin ? (
              <Login setIsLogin={setIsLogin} />
            ) : (
              <SignupPage setIsLogin={setIsLogin} profilePhoto={profilePhoto} />
            )}

            <div className='mt-4 text-center'>
              <p className='text-gray-600 dark:text-gray-400'>
                {isLogin
                  ? "Don't have an account?"
                  : 'Already have an account?'}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className='ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline transition-colors'
                >
                  {isLogin ? 'Sign Up' : 'Log In'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced decorative elements */}
      <div className='fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0'>
        <div className='absolute -top-24 -left-24 w-48 sm:w-64 h-48 sm:h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse'></div>
        <div className='absolute top-10 -right-20 w-64 sm:w-80 h-64 sm:h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-pulse'></div>
        <div className='absolute -bottom-20 left-40 w-56 sm:w-72 h-56 sm:h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse'></div>
      </div>
    </div>
  )
}
