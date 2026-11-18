import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Floating sport objects rendered with WebGL: a chess pawn, table tennis ball, carrom striker, fencing blade and a dumbbell.
 * They drift, spin slowly and lean toward the pointer. Rendering pauses when off screen or when reduced motion is on.
 */
export default function Hero3D({ className = '' }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) } catch { return }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    el.appendChild(renderer.domElement)
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(0, 0, 11)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3b50ff, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(4, 6, 8); scene.add(key)
    const rim = new THREE.PointLight(0x9ab0ff, 60, 30); rim.position.set(-6, -2, 4); scene.add(rim)
    const warm = new THREE.PointLight(0xd9f24c, 50, 30); warm.position.set(6, -4, 3); scene.add(warm)

    const mat = (color: number, rough = 0.28, metal = 0.1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
    const floaters: { obj: THREE.Object3D; base: THREE.Vector3; spin: THREE.Vector3; phase: number; amp: number }[] = []
    const add = (obj: THREE.Object3D, x: number, y: number, z: number, spin: [number, number, number], amp = 0.25) => {
      obj.position.set(x, y, z); scene.add(obj)
      floaters.push({ obj, base: new THREE.Vector3(x, y, z), spin: new THREE.Vector3(...spin), phase: Math.random() * 6, amp })
    }

    // chess pawn (lathe profile + head)
    const pawn = new THREE.Group()
    const prof = [[0, 0], [0.9, 0], [0.9, 0.18], [0.6, 0.32], [0.38, 1.1], [0.62, 1.2], [0.62, 1.36], [0.3, 1.42]].map(([x, y]) => new THREE.Vector2(x, y))
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), mat(0xff5a1f, 0.22, 0.15))
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 40, 40), mat(0xff5a1f, 0.22, 0.15)); head.position.y = 1.78
    pawn.add(body, head); pawn.scale.setScalar(1.15)
    add(pawn, 2.3, -0.6, 0, [0, 0.4, 0], 0.22)

    // table tennis ball
    add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 48), mat(0xd9f24c, 0.35, 0.05)), -1.0, 2.0, 1.4, [0.2, 0.3, 0], 0.35)

    // carrom striker: disc with a gold ring
    const striker = new THREE.Group()
    striker.add(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.22, 64), mat(0x0a0f24, 0.3, 0.2)))
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.06, 20, 64), mat(0xd9f24c, 0.25, 0.6)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12
    striker.add(ring); striker.rotation.x = 0.9
    add(striker, -2.2, -1.7, 0.6, [0.15, 0.5, 0.1], 0.3)

    // fencing blade
    const blade = new THREE.Group()
    const steel = mat(0xd8dee9, 0.18, 0.9)
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 4.1, 0.03), steel); b.position.y = 2.15
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 16, 40), mat(0xd9f24c, 0.25, 0.7)); guard.rotation.x = Math.PI / 2; guard.position.y = 0.1
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.95, 24), mat(0x0b1220, 0.5, 0.1)); grip.position.y = -0.4
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), steel); pommel.position.y = -0.95
    blade.add(b, guard, grip, pommel); blade.rotation.z = -0.9; blade.scale.setScalar(0.95)
    add(blade, 0.1, -0.2, -1.2, [0, 0.35, 0], 0.18)

    // dumbbell
    const bell = new THREE.Group()
    const iron = mat(0x1e8a3c, 0.3, 0.35)
    bell.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.5, 24), steel))
    for (const y of [-0.62, 0.62]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 40), iron); w.position.y = y; bell.add(w) }
    bell.rotation.z = Math.PI / 2.6
    add(bell, 1.6, 2.5, -0.6, [0.2, 0.25, 0.1], 0.3)

    const size = () => {
      const w = el.clientWidth || 600, h = el.clientHeight || 520
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.position.z = w < 520 ? 15 : 12.5
      camera.updateProjectionMatrix()
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(el)

    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }
    const onMove = (e: PointerEvent) => { target.x = (e.clientX / window.innerWidth - 0.5) * 2; target.y = (e.clientY / window.innerHeight - 0.5) * 2 }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf = 0, visible = true
    const clock = new THREE.Clock()
    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      const t = clock.getElapsedTime()
      cur.x += (target.x - cur.x) * 0.05; cur.y += (target.y - cur.y) * 0.05
      floaters.forEach((f, i) => {
        f.obj.position.y = f.base.y + Math.sin(t * 0.8 + f.phase) * f.amp
        f.obj.position.x = f.base.x + Math.cos(t * 0.5 + f.phase) * f.amp * 0.4 + cur.x * (0.25 + i * 0.06)
        f.obj.rotation.x += f.spin.x * 0.01; f.obj.rotation.y += f.spin.y * 0.01; f.obj.rotation.z += f.spin.z * 0.01
      })
      scene.rotation.y = cur.x * 0.18; scene.rotation.x = cur.y * 0.1
      renderer.render(scene, camera)
    }
    if (reduced) { renderer.render(scene, camera) } else { frame() }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0 }); io.observe(el)

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); window.removeEventListener('pointermove', onMove)
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mm = m.material as THREE.Material | undefined; mm?.dispose?.() })
      renderer.dispose(); renderer.domElement.remove()
    }
  }, [])

  return <div ref={host} className={className} aria-hidden />
}
