const express = require('express')
const multer = require('multer')
const path = require('path')
const jwt = require('jsonwebtoken')
const {
  validateSignup,
  validateLogin,
} = require('../middlewares/validation')

// const authMiddleware = require('../middlewares/authMiddleware')
const { signupUser, loginUser, logoutUser } = require('../controllers/authController')
const { log } = require('console')

const router = express.Router()

// Multer storage setup (stores files in memory)
const storage = multer.memoryStorage()
const upload = multer({ storage })

// Signup route with profile photo upload
router.post(
  '/signup',
  upload.single('profilePhoto'),
  (req, res, next) => {
    console.log('File received in middleware:', req.file ? 'Yes' : 'No');
    if (req.file) {
      console.log('File details:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    }
    next();
  },
  validateSignup,
  signupUser
);

// Login route
router.post('/login', validateLogin, loginUser)

// Verify token
router.get('/verify', (req, res) => {
  const token = req.cookies.crowdInfra_token // Get token from cookies

  console.log(token)

  if (!token) {
    console.log('no token'.red)
    return res.status(401).json({ valid: false, msg: 'No token provided' })
  }

  console.log('token provided'.green)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log(`${decoded}`.red)
    console.log(decoded.user)
    return res.json({ valid: true, user: decoded.user })
  } catch (err) {
    console.log('invalid token'.red)
    console.log(err)
    return res.status(401).json({ valid: false, msg: 'Invalid token' })
  }
})

// Logout route
router.post('/logout', logoutUser)

module.exports = router
