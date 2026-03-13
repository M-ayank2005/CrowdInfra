'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const RotatingEarth = ({ onReady, onError }) => {
  const containerRef = useRef(null)
  
  useEffect(() => {
    if (!containerRef.current) return

    let animationFrameId = 0
    let isDisposed = false
    let earthTexture = null
    let readyNotified = false

    const notifyReady = () => {
      if (!readyNotified) {
        readyNotified = true
        onReady?.()
      }
    }

    const notifyError = (error) => {
      if (!readyNotified) {
        readyNotified = true
      }
      onError?.(error)
    }
    
    // Set up scene
    const scene = new THREE.Scene()
    
    // Set up camera with perfect positioning
    const camera = new THREE.PerspectiveCamera(
      50, 
      containerRef.current.clientWidth / containerRef.current.clientHeight, 
      0.1, 
      1000
    )
    camera.position.z = 2.8
    
    // Set up high-quality renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000, 0)
    containerRef.current.appendChild(renderer.domElement)
    
    // Create detailed sphere for Earth
    const geometry = new THREE.SphereGeometry(1, 128, 128)
    
    // Load Earth texture
    const textureLoader = new THREE.TextureLoader()
    earthTexture = textureLoader.load(
      '/earth.webp',
      () => notifyReady(),
      undefined,
      (error) => notifyError(error)
    )
    
    // Create atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(1.02, 128, 128)
    const atmosphereMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 0.5) * intensity;
        }
      `
    })
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
    scene.add(atmosphere)
    
    // Create enhanced material with the texture
    const material = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 10,
      specular: new THREE.Color(0x333333)
    })
    
    // Create the Earth mesh
    const earth = new THREE.Mesh(geometry, material)
    scene.add(earth)
    
    // Add ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
    scene.add(ambientLight)
    
    // Add directional light for sunlight effect
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
    directionalLight.position.set(5, 3, 5)
    scene.add(directionalLight)
    
    // Add a subtle blue point light for atmosphere effect
    const blueLight = new THREE.PointLight(0x3677ac, 0.8)
    blueLight.position.set(-5, -3, -5)
    scene.add(blueLight)
    
    // Add stars in the background
    const starsGeometry = new THREE.BufferGeometry()
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      transparent: true
    })
    
    const starsVertices = []
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 20
      const y = (Math.random() - 0.5) * 20
      const z = (Math.random() - 0.5) * 20
      
      // Ensure stars are not too close to Earth
      if (Math.sqrt(x*x + y*y + z*z) > 5) {
        starsVertices.push(x, y, z)
      }
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3))
    const stars = new THREE.Points(starsGeometry, starsMaterial)
    scene.add(stars)
    
    // Animation loop with smooth rotation
    let lastTime = 0
    const rotationSpeed = 0.05 // Degrees per second
    
    const animate = (time) => {
      if (isDisposed) return

      const delta = (time - lastTime) / 1000
      lastTime = time
      
      // Rotate the earth with consistent speed
      earth.rotation.y += rotationSpeed * delta
      atmosphere.rotation.y += rotationSpeed * delta
      
      // Subtle floating animation for stars
      stars.rotation.y += 0.0005
      
      renderer.render(scene, camera)
      animationFrameId = requestAnimationFrame(animate)
    }
    
    // Responsive window resizing
    const handleResize = () => {
      if (!containerRef.current) return
      
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }
    
    window.addEventListener('resize', handleResize)
    
    // Start animation
    animationFrameId = requestAnimationFrame(animate)
    
    // Cleanup
    return () => {
      isDisposed = true
      window.removeEventListener('resize', handleResize)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement)
      }
      geometry.dispose()
      material.dispose()
      earthTexture?.dispose()
      atmosphereGeometry.dispose()
      atmosphereMaterial.dispose()
      starsGeometry.dispose()
      starsMaterial.dispose()
      renderer.dispose()
    }
  }, [onError, onReady])
  
  return <div ref={containerRef} className="w-full h-full" />
}

export default RotatingEarth
