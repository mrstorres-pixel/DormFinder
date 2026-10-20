import { Scene, Color, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, DoubleSide, ACESFilmicToneMapping } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// An original, deliberately modest student room. No downloaded models or textures.
export function createDormRoom(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' })
  const scene = new Scene()
  scene.background = new Color('#f0f4fa')
  renderer.setClearColor('#f0f4fa')
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  const camera = new PerspectiveCamera(54, 1, .05, 40)
  const geometry = new Set(), materials = new Map()
  const details = new Group(); scene.add(details)
  function material(color, basic = false) {
    const key = color + basic
    if (!materials.has(key)) materials.set(key, basic ? new MeshBasicMaterial({ color, side: DoubleSide }) : new MeshStandardMaterial({ color, roughness: .88 }))
    return materials.get(key)
  }
  function mesh(shape, color, position, parent = scene, basic = false) {
    geometry.add(shape)
    const object = new Mesh(shape, material(color, basic))
    object.position.set(...position); parent.add(object)
    return object
  }
  function box(size, position, color, parent = scene) { return mesh(new BoxGeometry(...size), color, position, parent) }
  function cushion(size, position, color) { return mesh(new RoundedBoxGeometry(...size, 2, .075), color, position) }
  function cylinder(top, bottom, height, position, color, parent = scene) { return mesh(new CylinderGeometry(top, bottom, height, 16), color, position, parent) }
  function shadow(width, depth, x, z, parent = scene) {
    const mat = new MeshBasicMaterial({ color: '#5e4934', transparent: true, opacity: .10, depthWrite: false })
    materials.set('shadow-' + materials.size, mat)
    const shape = new PlaneGeometry(width, depth); geometry.add(shape)
    const object = new Mesh(shape, mat); object.rotation.x = -Math.PI / 2; object.position.set(x, .015, z); parent.add(object)
  }
  scene.add(new HemisphereLight('#f4f7ff', '#9f8266', 2.6))
  const sun = new DirectionalLight('#fff3df', 3.2); sun.position.set(-3, 6, -2); scene.add(sun)
  const fill = new DirectionalLight('#dceaff', 1.2); fill.position.set(3, 3, 7); scene.add(fill)

  // Floor, plaster walls and a centered doorway, with the camera outside initially.
  box([48, .16, 15], [0, -.09, 2.5], '#c9a77d')
  for (let i = 0; i < 17; i++) box([.012, .006, 15], [-3.15 + i * .39, .003, 2.5], '#b89770', details)
  box([6.4, 3.4, .16], [0, 1.7, -3.6], '#f4f7fc')
  box([.16, 3.4, 7.2], [-3.2, 1.7, 0], '#f5f7fc')
  box([.16, 3.4, 7.2], [3.2, 1.7, 0], '#e6edf7')
  // Extend the hallway facade beyond the camera frustum, keeping the room and doorway human-scale.
  // Its former outer edges exposed the background and side-wall caps at wide/tall aspect ratios.
  for (const direction of [-1, 1]) {
    box([23.15, 8, .2], [direction * 12.425, 4, 3.6], '#f5f7fc')
    box([23.15, .12, .055], [direction * 12.425, .06, 3.73], '#ffffff')
  }
  box([1.7, 5.15, .2], [0, 5.425, 3.6], '#f5f7fc')
  for (const x of [-.9, .9]) box([.12, 2.94, .28], [x, 1.47, 3.62], '#ffffff')
  box([1.92, .12, .28], [0, 2.94, 3.62], '#ffffff')
  box([6.2, .12, .06], [0, .06, -3.47], '#faf3e6')
  for (const x of [-3.08, 3.08]) box([.06, .12, 7], [x, .06, 0], '#faf3e6')
  // Hallway details give the opening scene a sense of arrival.
  box([.38, .17, .035], [1.3, 1.8, 3.73], '#86654a')
  for (const x of [1.21, 1.29, 1.37]) box([.025, .065, .02], [x, 1.8, 3.76], '#f0debc', details)
  box([1.5, .025, .75], [0, .02, 4.3], '#a98561')
  for (let i = 0; i < 7; i++) box([1.4, .006, .012], [0, .036, 4 + i * .1], '#92704e', details)
  const door = new Group(); door.position.set(-.84, 0, 3.6); scene.add(door)
  box([1.68, 2.84, .09], [.84, 1.42, 0], '#15386a', door)
  for (const y of [.74, 2]) {
    box([1.35, 1.05, .025], [.84, y, .06], '#204a82', door)
    box([1.17, .88, .02], [.84, y, .077], '#1b4278', door)
  }
  box([.06, .2, .05], [1.48, 1.35, .09], '#c6ab70', door)
  box([.2, .035, .06], [1.41, 1.39, .13], '#e2c991', door)

  // Bright window, curtains and warm patches of sunlight; no shadow-map cost.
  box([2.5, 1.85, .08], [-.65, 2.05, -3.48], '#b8c8bc')
  mesh(new PlaneGeometry(2.28, 1.62), '#dce9dc', [-.65, 2.05, -3.425], scene, true)
  for (const x of [-1.87, .57]) box([.075, 1.92, .14], [x, 2.05, -3.39], '#fff7e7')
  for (const y of [1.14, 2.96]) box([2.55, .075, .14], [-.65, y, -3.39], '#fff7e7')
  box([.055, 1.8, .09], [-.65, 2.05, -3.36], '#fff7e7')
  box([2.45, .055, .09], [-.65, 2.05, -3.36], '#fff7e7')
  box([2.8, .075, .32], [-.65, 1.09, -3.32], '#b48b60')
  box([3.05, .045, .05], [-.65, 3.08, -3.23], '#90714f')
  for (const x of [-2, .7]) {
    box([.36, 1.95, .12], [x, 2.06, -3.2], '#b5c6dc')
    for (let i = 0; i < 4; i++) box([.04, 1.94, .04], [x - .13 + i * .085, 2.06, -3.12], '#d5e0ee', details)
  }
  for (let i = 0; i < 2; i++) {
    const patch = mesh(new PlaneGeometry(.95, 2.5), '#e4c59a', [-.85 + i * 1.08, .012, -.75], scene, true)
    patch.rotation.x = -Math.PI / 2; patch.rotation.z = -.25
  }

  // Single bed on the right, with a sage duvet, pillow and woven throw.
  shadow(1.72, 2.8, 1.95, -1.55)
  box([1.55, .2, 2.55], [1.95, .36, -1.55], '#936b49')
  for (const x of [1.29, 2.61]) for (const z of [-2.65, -.45]) box([.1, .32, .1], [x, .16, z], '#805938')
  box([1.62, 1.05, .12], [1.95, .65, -2.85], '#bd9570')
  cushion([1.48, .22, 2.4], [1.95, .56, -1.55], '#f4ecde')
  cushion([1.5, .17, 1.68], [1.95, .73, -1.18], '#92b2d2')
  cushion([1.25, .16, .43], [1.95, .75, -2.42], '#fff5df')
  box([1.53, .035, .52], [1.95, .84, -.67], '#315cce')
  for (let i = 0; i < 9; i++) box([.012, .006, .49], [1.26 + i * .17, .862, -.67], '#abc1f1', details)

  // Desk and chair on the left; all dimensions are deliberately human-scale.
  shadow(1.85, .9, -1.65, -2.65)
  box([1.9, .1, .8], [-1.65, .9, -2.65], '#bc9164')
  for (const x of [-2.45, -.85]) for (const z of [-2.96, -2.34]) box([.075, .85, .075], [x, .43, z], '#8d6746')
  box([.55, .1, .55], [-1.6, .49, -1.73], '#ae7c51')
  box([.55, .53, .08], [-1.6, .79, -1.46], '#ae7c51')
  for (const x of [-1.82, -1.38]) for (const z of [-1.95, -1.51]) box([.045, .47, .045], [x, .24, z], '#795536')
  box([.48, .025, .3], [-1.6, .965, -2.62], '#d9c4a2')
  const laptop = box([.48, .31, .025], [-1.6, 1.12, -2.76], '#5a6155'); laptop.rotation.x = -.15
  box([.42, .25, .012], [-1.6, 1.12, -2.735], '#a9b9ae')
  cylinder(.11, .14, .04, [-2.29, .97, -2.76], '#716b52')
  cylinder(.018, .018, .42, [-2.29, 1.18, -2.76], '#716b52')
  cylinder(.09, .17, .16, [-2.29, 1.43, -2.76], '#c99056')
  for (let i = 0; i < 3; i++) box([.3, .045, .2], [-.97, .98 + i * .046, -2.66], ['#a65c3c', '#c9b78f', '#7e9484'][i])
  cylinder(.055, .05, .11, [-1.05, 1.01, -2.35], '#f3e4cb', details)

  // Storage, a bedside table and original abstract wall art.
  box([.8, 2.15, 1.2], [-2.7, 1.075, .7], '#ba9871')
  box([.025, 2.06, .022], [-2.28, 1.075, .7], '#92714f')
  for (const z of [.6, .8]) box([.055, .2, .025], [-2.25, 1.12, z], '#78583d')
  box([.55, .52, .55], [.78, .26, -2.55], '#c4a27d')
  box([.5, .18, .025], [.78, .36, -2.26], '#b68e62')
  box([.09, .025, .04], [.78, .36, -2.23], '#876747')
  box([.035, .8, .65], [3.095, 2, -1.65], '#a37a50')
  box([.02, .68, .53], [3.07, 2, -1.65], '#f1dfbd')
  const art = mesh(new SphereGeometry(.2, 16, 12), '#b66b49', [3.048, 2.08, -1.65]); art.scale.x = .03
  // Rug and plant, with leaves simplified on mobile.
  box([2.05, .018, 2.7], [.1, .017, .1], '#ddc9a5')
  for (const x of [-.84, 1.04]) box([.055, .005, 2.53], [x, .029, .1], '#b99a76', details)
  cylinder(.22, .16, .43, [.92, .23, -3.08], '#b56745')
  cylinder(.025, .025, .8, [.92, .8, -3.08], '#536b47')
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4
    const leaf = mesh(new SphereGeometry(1, 10, 8), i % 2 ? '#84936b' : '#657e56', [.92 + Math.cos(angle) * .18, .65 + i * .085, -3.08 + Math.sin(angle) * .18], i > 3 ? details : scene)
    leaf.scale.set(.12, .28, .065); leaf.rotation.set(.3, angle, -.7)
  }

  // Batch static furniture by material instead of issuing a draw call per plank/book.
  for (const parent of [scene, details, door]) {
    const batches = new Map()
    for (const child of [...parent.children]) {
      if (!child.isMesh || child.material.transparent) continue
      child.updateMatrix()
      const shape = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
      shape.applyMatrix4(child.matrix)
      if (!batches.has(child.material)) batches.set(child.material, [])
      batches.get(child.material).push(shape)
      parent.remove(child)
      geometry.delete(child.geometry); child.geometry.dispose()
    }
    for (const [mat, shapes] of batches) {
      const combined = mergeGeometries(shapes, false)
      shapes.forEach(shape => shape.dispose())
      geometry.add(combined); parent.add(new Mesh(combined, mat))
    }
  }

  let disposed = false
  return {
    resize(width, height, mobile) {
      const renderWidth = Math.max(1, width), renderHeight = Math.max(1, height)
      // Bound GPU work per viewport; changing buffers mid-scroll can blank WebKit's canvas.
      const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5, Math.sqrt(2_000_000 / (renderWidth * renderHeight)))
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(renderWidth, renderHeight, false)
      camera.aspect = width / Math.max(1, height); camera.fov = mobile ? 68 : 54; camera.updateProjectionMatrix()
      details.visible = !mobile
    },
    render(state, mobile) {
      if (disposed) return
      door.rotation.y = state.door
      const x = (mobile ? 0 : -1.8) * (1 - Math.min(1, state.travel * 2))
      const start = mobile ? 7.9 : 7.4, end = mobile ? 2.8 : 2.1
      const z = start + (end - start) * state.travel
      camera.fov = mobile ? 68 + state.travel * 24 : 54
      camera.updateProjectionMatrix()
      camera.position.set(x, mobile ? 1.8 : 1.6, z)
      camera.lookAt(x, mobile ? 1.8 : 1.6, z - 10)
      renderer.render(scene, camera)
    },
    dispose() {
      if (disposed) return
      disposed = true
      geometry.forEach(item => item.dispose()); materials.forEach(item => item.dispose())
      renderer.dispose()
    },
  }
}
