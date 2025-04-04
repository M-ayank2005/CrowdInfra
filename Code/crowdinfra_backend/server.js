//> Load environment variables at the very top
require('dotenv').config()

//> All Libraries
const express = require('express')
const listEndpoints = require('express-list-endpoints')
const connectDBs = require('./config/db')
const cors = require('cors')
const colors = require('colors')
const morgan = require('morgan')
const path = require('path')
const cookieParser = require('cookie-parser')

//> Import Routes
// const userRoutes = require("./routes/userRoutes");
const propertyRoutes = require("./routes/property");
// const demandRoutes = require("./routes/demandRoutes");
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/user')
const demandRoutes = require('./routes/demand')
const ratingRoutes = require('./routes/ratingroutes');

const app = express();

(async () => {
  try {
    const { usersDB } = await connectDBs() // Establish connections

    // Middlewares
    app.use(express.urlencoded({ extended: true }))
    app.use(express.json())
    app.use(
      cors({
      origin: ['http://localhost:3000', 'https://infra-crowd.vercel.app'], // 👈 Allow both frontend URLs
      credentials: true, // 👈 Allow cookies & authorization headers
      })
    )
    app.use(cookieParser())
    app.use(morgan('dev'))
    // Serve static files from the "uploads" folder
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
    app.use(express.static('public'))
    console.log(`${path.join(__dirname, 'uploads')}`.dim)

    // Routes
    app.use('/api/auth', authRoutes)

    app.use('/api/user', userRoutes)

    app.use('/api/property' ,propertyRoutes)

    app.use('/api/demand', demandRoutes)
    app.use('/api/rating', ratingRoutes)

    // Basic route for health check at root endpoint
    app.get('/', (req, res) => {
      res.json({ 
        message: 'CrowdInfra API is running',
        status: 'OK',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });
    // Environment Variables
    console.log('=========================================='.yellow)
    console.log('🚀 Database Connection URIs'.cyan.bold)
    console.log('=========================================='.yellow)
    console.log(
      '📌 USERS_DB_URI:      '.magenta + process.env.USERS_DB_URI.italic
    )
    console.log(
      '📌 PROPERTIES_DB_URI: '.magenta + process.env.PROPERTIES_DB_URI.italic
    )
    console.log(
      '📌 DEMANDS_DB_URI:    '.magenta + process.env.DEMANDS_DB_URI.italic
    )
    console.log('=========================================='.yellow)

    // Server
    const PORT = process.env.PORT || 5000
    app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`.blue.bgGreen)
    )

    // Print all registered routes
    console.log(listEndpoints(app))
  } catch (err) {
    console.error('❌ Server Initialization Error:', err.message)
    process.exit(1) 
  }
})()
