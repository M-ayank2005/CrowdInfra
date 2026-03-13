'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation' // For redirection
import { toast } from 'react-toastify' // For toast messages

import Link from 'next/link'
import axios from 'axios'

const LoginPage = ({ setIsLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = 'Email is invalid'

    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 6)
      newErrors.password = 'Password must be at least 6 characters'

    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validate()

    console.log(JSON.stringify(formData, null, 2))

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true)
      try {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/login`,
          formData,
          { withCredentials: true }
        )
        console.log('Login response:', response.data)
        if (response.data && response.data.success) {
          toast.success('Login successful! Redirecting to home...')
          setIsLogin(true)
          router.push('/')
        } else {
          throw new Error('Login failed')
        }
      } catch (error) {
        console.error('Login error:', error)
        setErrors({ submit: 'Failed to login. Please try again.' })
      } finally {
        setIsSubmitting(false)
      }
    } else {
      setErrors(newErrors)
    }
  }

  return (
    <div className='w-full text-white'>
      <div className='mx-auto w-full'>
        <div className='rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl sm:p-8'>
            <div className='text-center mb-8'>
              <h1 className='text-4xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500'>
                Login
              </h1>
              <div
                className='text-gray-400 text-sm mt-2 mb-6'
                onClick={() => setIsLogin(false)}
              >
                Don't have an account?{' '}
                <Link
                  href='/auth'
                  className='text-blue-400 hover:text-blue-300 underline-none transition-colors duration-300'
                >
                  Create account
                </Link>
              </div>
            </div>

            <form onSubmit={handleSubmit} className='space-y-4'>
              {/* Email */}
              <div className='mb-4'>
                <label
                  className='block text-gray-300 mb-2 text-sm font-medium'
                  htmlFor='email'
                >
                  Email Address
                </label>
                <div className='relative'>
                  <input
                    type='email'
                    id='email'
                    name='email'
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-transparent rounded-lg border ${
                      errors.email ? 'border-red-500' : 'border-gray-700'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300`}
                    placeholder='Enter your Email'
                  />
                  {errors.email && (
                    <p className='text-red-500 text-xs mt-1'>{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className='mb-4'>
                <label
                  className='block text-gray-300 mb-2 text-sm font-medium'
                  htmlFor='password'
                >
                  Password
                </label>
                <div className='relative'>
                  <input
                    type='password'
                    id='password'
                    name='password'
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 bg-transparent rounded-lg border ${
                      errors.password ? 'border-red-500' : 'border-gray-700'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300`}
                    placeholder='Enter your password'
                  />
                  {errors.password && (
                    <p className='text-red-500 text-xs mt-1'>
                      {errors.password}
                    </p>
                  )}
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className='flex justify-end mb-6'>
                <Link
                  href='/forgot-password'
                  className='text-sm text-blue-400 hover:text-blue-300 transition-colors duration-300'
                >
                  Forgot password?
                </Link>
              </div>

              {/* Error message */}
              {errors.submit && (
                <div className='bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4'>
                  <p className='text-red-500 text-sm'>{errors.submit}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type='submit'
                className='w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg'
                onClick={() =>{
                  localStorage.setItem('email', formData.email)
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className='flex items-center justify-center'>
                    <svg
                      className='animate-spin -ml-1 mr-3 h-5 w-5 text-white'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                    >
                      <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                      ></circle>
                      <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                      ></path>
                    </svg>
                    Logging in...
                  </span>
                ) : (
                  'Login'
                )}
              </button>
            </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
