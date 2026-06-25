'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function AmbientParticles() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (document.documentElement.classList.contains('vp-low-bandwidth')) return

    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(1)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.z = 20

    const count = 120
    const positions = new Float32Array(count * 3)
    const velocities: { vx: number; vy: number; vz: number }[] = []

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10
      velocities.push({
        vx: (Math.random() - 0.5) * 0.008,
        vy: (Math.random() - 0.5) * 0.006,
        vz: 0,
      })
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Mix mist (#B9C8FF) and aqua (#22D3EE) particles
    const colors = ['#B9C8FF', '#22D3EE', '#B9C8FF', '#12A28B']
    const groups = colors.map((c, ci) => {
      const gCount = Math.floor(count / colors.length)
      const g = new THREE.BufferGeometry()
      const p = new Float32Array(gCount * 3)
      for (let j = 0; j < gCount; j++) {
        const idx = ci * gCount + j
        p[j * 3] = positions[idx * 3]
        p[j * 3 + 1] = positions[idx * 3 + 1]
        p[j * 3 + 2] = positions[idx * 3 + 2]
      }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3))
      const mat = new THREE.PointsMaterial({
        color: new THREE.Color(c),
        size: ci % 2 === 0 ? 0.08 : 0.055,
        transparent: true,
        opacity: 0.2,
        sizeAttenuation: true,
      })
      const pts = new THREE.Points(g, mat)
      scene.add(pts)
      return { pts, geo: g, startIdx: ci * gCount, gCount }
    })

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    let raf: number
    function animate() {
      raf = requestAnimationFrame(animate)
      if (document.hidden) return

      const hw = 21, hh = 16
      groups.forEach(({ geo: g, startIdx, gCount }) => {
        const pos = g.attributes.position.array as Float32Array
        for (let j = 0; j < gCount; j++) {
          const v = velocities[startIdx + j]
          pos[j * 3] += v.vx
          pos[j * 3 + 1] += v.vy
          // Wrap edges
          if (pos[j * 3] > hw) pos[j * 3] = -hw
          if (pos[j * 3] < -hw) pos[j * 3] = hw
          if (pos[j * 3 + 1] > hh) pos[j * 3 + 1] = -hh
          if (pos[j * 3 + 1] < -hh) pos[j * 3 + 1] = hh
        }
        g.attributes.position.needsUpdate = true
      })

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  )
}
