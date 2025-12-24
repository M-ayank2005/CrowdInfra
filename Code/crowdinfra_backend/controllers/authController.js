const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const getUserModel = require('../models/User')
const path = require('path')
const fs = require('fs')
const colors = require('colors')

// Use a strong environment-specific secret with fallback for development only
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error(
    'WARNING: JWT_SECRET environment variable not set. Using insecure default for development only.'
  )
}

const saveProfilePhoto = (userId, file) => {
  if (!file) {
    console.log('No file provided for upload')
    return ''
  }

  try {
    // Use an absolute path relative to project root
    const uploadDir = path.join(process.cwd(), 'uploads')
    console.log(`Creating upload directory: ${uploadDir}`)

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
      console.log(`Created directory: ${uploadDir}`)
    }

    // Rest of your function remains the same
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.avif']
    const ext = path.extname(file.originalname).toLowerCase()

    if (!allowedExtensions.includes(ext)) {
      throw new Error('Invalid file type. Only JPG, PNG and GIF are allowed.')
    }

    const filename = `${userId}${ext}`
    const filePath = path.join(uploadDir, filename)

    console.log(`Saving file to: ${filePath}`)
    fs.writeFileSync(filePath, file.buffer)

    console.log(`Profile photo saved: ${filePath}`)

    return `/uploads/${filename}`
  } catch (error) {
    console.error(`Error saving profile photo: ${error}`)
    return '' // Return empty string but don't throw, to continue registration
  }
}

//> Signup Controller
const signupUser = async (req, res) => {
  const User = await getUserModel()

  const { name, email, password, phone, address, gender } = req.body
  const profilePhoto = req.file // Uploaded file

  try {
    // Input validation
    if (!name || !email || !password) {
      console.log('Missing required fields'.red)
      return res
        .status(400)
        .json({ error: 'Name, email and password are required' })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.log('Invalid email format'.red)
      return res.status(400).json({ error: 'Invalid email format' })
    }

    // Validate password strength
    if (password.length < 6) {
      console.log('Weak password'.red)
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters long' })
    }

    // Check if user already exists
    let user = await User.findOne({ email })
    if (user) {
      console.log('User already exists'.red)
      return res.status(400).json({ error: 'User already exists' })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Step 1: Create User First (Without Profile Photo)
    user = new User({
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      address: address || '',
      gender: gender || '',
      profile_image: '', // Initially empty
    })

    await user.save() // Save user to generate `_id`

    // Step 2: Now Save Profile Photo with `_id`
    let profileImagePath = ''
    if (profilePhoto) {
      try {
        profileImagePath = saveProfilePhoto(user._id, profilePhoto)
        user.profile_image = profileImagePath
        await user.save() // Update user with image path
      } catch (photoError) {
        console.error('Profile photo error:', photoError.message)
        // Continue registration even if photo upload fails
      }
    }

    // Return response (exclude password from response)
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        gender: user.gender,
        profile_image: profileImagePath,
        role: user.role,
        createdAt: user.createdAt,
      },
    })
  } catch (err) {
    console.error('Signup error:', err.message)
    res
      .status(500)
      .json({ error: 'Server error during registration. Please try again.' })
  }
}

// > Login Controller
const loginUser = async (req, res) => {
  const User = await getUserModel()
  const { email, password } = req.body

  try {
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Check if user exists
    let user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    // Generate JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    }

    // Make sure JWT_SECRET is defined before signing
    if (!JWT_SECRET) {
      return res
        .status(500)
        .json({ error: 'Authentication service misconfigured' })
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '10h' })

    // Set cookie based on environment
    const isProduction = process.env.NODE_ENV === 'production'

    res.cookie('crowdInfra_token', token, {
      httpOnly: true, 
      secure: true,
      sameSite: 'None', 
      partitioned: true,
      maxAge: 10 * 60 * 60 * 1000,
    })

    res.status(200).json({ message: 'Login successful', success: true })
  } catch (err) {
    console.error('Login error:', err.message)
    res
      .status(500)
      .json({ error: 'Server error during login. Please try again.' })
  }
}

//> Logout controller
const logoutUser = (req, res) => {
  res.clearCookie('crowdInfra_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only secure in production
    sameSite: 'Strict',
  })

  res.status(200).json({ success: true, message: 'Logged out successfully' })
}

module.exports = {
  signupUser,
  loginUser,
  logoutUser,
}
