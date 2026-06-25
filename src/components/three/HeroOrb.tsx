'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function HeroOrb({ className = '' }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    mount.appendChild(renderer.domElement)

    // Scene & Camera
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0, 0, 6)

    // Root group (parallax target)
    const root = new THREE.Group()
    scene.add(root)

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.3)
    scene.add(ambient)

    const warmLight = new THREE.DirectionalLight(0xF59E0B, 2.4) // saffron
    warmLight.position.set(3, 3, 2)
    warmLight.castShadow = true
    scene.add(warmLight)

    const coolLight = new THREE.DirectionalLight(0x22D3EE, 1.8) // aqua
    coolLight.position.set(-3, -1, 3)
    scene.add(coolLight)

    const fillLight = new THREE.PointLight(0x4F46E5, 1.2, 12) // indigo
    fillLight.position.set(0, 2, 2)
    scene.add(fillLight)

    // Central glass sphere
    const sphereGeo = new THREE.SphereGeometry(1.4, 64, 64)
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.92,
      ior: 1.5,
      thickness: 0.8,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 1.0,
    })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.castShadow = true
    root.add(sphere)

    // Inner glow sphere
    const innerGeo = new THREE.SphereGeometry(1.1, 32, 32)
    const innerMat = new THREE.MeshPhysicalMaterial({
      color: 0x12A28B,
      metalness: 0.1,
      roughness: 0.2,
      transparent: true,
      opacity: 0.18,
      emissive: new THREE.Color(0x12A28B),
      emissiveIntensity: 0.4,
    })
    const inner = new THREE.Mesh(innerGeo, innerMat)
    root.add(inner)

    // Orbital torus rings
    const torusData = [
      { radius: 2.1, tube: 0.012, color: 0x12A28B, rx: Math.PI / 3, ry: 0, rz: 0.4, speed: 0.004 },
      { radius: 2.6, tube: 0.009, color: 0x4F46E5, rx: Math.PI / 5, ry: Math.PI / 4, rz: 0.2, speed: -0.003 },
      { radius: 3.0, tube: 0.007, color: 0x22D3EE, rx: Math.PI / 2.5, ry: Math.PI / 6, rz: -0.3, speed: 0.002 },
    ]
    const tori = torusData.map(d => {
      const geo = new THREE.TorusGeometry(d.radius, d.tube, 8, 128)
      const mat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.set(d.rx, d.ry, d.rz)
      root.add(mesh)
      return { mesh, speed: d.speed }
    })

    // Floating particles (Lissajous)
    const particleCount = 45
    const positions = new Float32Array(particleCount * 3)
    const phases = Array.from({ length: particleCount }, () => ({
      ax: (Math.random() * 1.5 + 0.8),
      ay: (Math.random() * 1.5 + 0.8),
      az: (Math.random() * 1.5 + 0.8),
      fx: Math.random() * 1.5 + 0.5,
      fy: Math.random() * 1.5 + 0.5,
      fz: Math.random() * 1.5 + 0.5,
      phi: Math.random() * Math.PI * 2,
      psi: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.4 + 0.2,
    }))
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pColors = ['#12A28B', '#B9C8FF', '#22D3EE', '#F59E0B']
    const pMats = pColors.map(c => new THREE.PointsMaterial({
      color: new THREE.Color(c),
      size: 0.055,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    }))
    const particleChunks = pMats.map((mat, mi) => {
      const count = Math.floor(particleCount / pMats.length)
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(count * 3)
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const pts = new THREE.Points(geo, mat)
      root.add(pts)
      return { pts, geo, startIdx: mi * count, count }
    })

    // Mouse parallax state
    let mouseX = 0, mouseY = 0
    let targetRX = 0, targetRY = 0
    const onMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect()
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2
      targetRY = mouseX * 0.25
      targetRX = -mouseY * 0.18
    }
    mount.addEventListener('mousemove', onMouseMove)

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!mount) return
      const w = mount.clientWidth, h = mount.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(mount)

    // Animation loop
    let raf: number
    let elapsed = 0
    const clock = new THREE.Clock()

    function animate() {
      raf = requestAnimationFrame(animate)
      if (document.hidden) return

      const dt = clock.getDelta()
      elapsed += dt

      // Lerp parallax
      root.rotation.x += (targetRX - root.rotation.x) * 0.06
      root.rotation.y += (targetRY - root.rotation.y) * 0.06

      // Sphere slow rotation
      sphere.rotation.y += 0.003
      inner.rotation.y -= 0.002
      inner.rotation.x += 0.001

      // Torus rings
      tori.forEach(({ mesh, speed }) => { mesh.rotation.z += speed })

      // Particles along Lissajous curves
      particleChunks.forEach(({ geo, startIdx, count }) => {
        const pos = geo.attributes.position.array as Float32Array
        for (let i = 0; i < count; i++) {
          const ph = phases[startIdx + i]
          const t = elapsed * ph.speed + ph.phi
          const t2 = elapsed * ph.speed * 1.3 + ph.psi
          pos[i * 3] = ph.ax * Math.sin(ph.fx * t)
          pos[i * 3 + 1] = ph.ay * Math.cos(ph.fy * t2)
          pos[i * 3 + 2] = ph.az * Math.sin(ph.fz * (t + t2 * 0.5))
        }
        geo.attributes.position.needsUpdate = true
      })

      // Animate fill light
      fillLight.position.x = Math.sin(elapsed * 0.7) * 2.5
      fillLight.position.z = Math.cos(elapsed * 0.5) * 2.5

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mount.removeEventListener('mousemove', onMouseMove)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className={`h-full w-full ${className}`} aria-hidden="true" />
}
