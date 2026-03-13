'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import Loading from './loading'

export default function HomeGlobe() {
  const containerRef = useRef(null)
  const cleanupRef = useRef(() => {})
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let isDisposed = false
    let cloudsFrameId = 0
    let resizeHandler = null
    let cloudsMesh = null
    let cloudsTexture = null

    const setupGlobe = async () => {
      if (!containerRef.current) {
        return
      }

      try {
        const { default: Globe } = await import('globe.gl')

        if (isDisposed || !containerRef.current) {
          return
        }

        const world = Globe()(containerRef.current)
          .globeImageUrl(
            '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
          )
          .bumpImageUrl(
            '//unpkg.com/three-globe/example/img/earth-topology.png'
          )

        world.controls().autoRotate = true
        world.controls().autoRotateSpeed = 0.35

        const updateSize = () => {
          if (!containerRef.current) {
            return
          }

          const { clientWidth, clientHeight } = containerRef.current
          world.width(clientWidth)
          world.height(clientHeight)
        }

        resizeHandler = () => updateSize()
        window.addEventListener('resize', resizeHandler)
        updateSize()

        const textureLoader = new THREE.TextureLoader()
        textureLoader.load(
          '/clouds.png',
          (texture) => {
            if (isDisposed) {
              texture.dispose()
              return
            }

            cloudsTexture = texture
            cloudsMesh = new THREE.Mesh(
              new THREE.SphereGeometry(world.getGlobeRadius() * 1.004, 75, 75),
              new THREE.MeshPhongMaterial({
                map: cloudsTexture,
                transparent: true,
              })
            )

            world.scene().add(cloudsMesh)

            const rotateClouds = () => {
              if (isDisposed || !cloudsMesh) {
                return
              }

              cloudsMesh.rotation.y += (-0.006 * Math.PI) / 180
              cloudsFrameId = requestAnimationFrame(rotateClouds)
            }

            rotateClouds()
          },
          undefined,
          () => {
            if (!isDisposed) {
              setStatus('ready')
            }
          }
        )

        setStatus('ready')

        cleanupRef.current = () => {
          if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler)
          }

          if (cloudsFrameId) {
            cancelAnimationFrame(cloudsFrameId)
          }

          if (cloudsMesh) {
            world.scene().remove(cloudsMesh)
            cloudsMesh.geometry.dispose()
            cloudsMesh.material.dispose()
          }

          cloudsTexture?.dispose()
          world.pauseAnimation?.()

          if (containerRef.current) {
            containerRef.current.innerHTML = ''
          }
        }
      } catch (error) {
        console.error('Failed to initialize home globe:', error)
        if (!isDisposed) {
          setStatus('error')
        }
      }
    }

    setupGlobe()

    return () => {
      isDisposed = true
      cleanupRef.current()
    }
  }, [])

  return (
    <div className='relative h-full w-full bg-black'>
      <div ref={containerRef} className='h-full w-full' />
      {status === 'loading' && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/60'>
          <Loading text='Loading globe...' size='sm' className='min-h-0 bg-transparent p-0' />
        </div>
      )}
      {status === 'error' && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-white'>
          <div>
            <h3 className='text-lg font-semibold'>Globe unavailable</h3>
            <p className='mt-2 text-sm text-slate-300'>
              The page is still usable, but the 3D globe could not be rendered on this reload.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}