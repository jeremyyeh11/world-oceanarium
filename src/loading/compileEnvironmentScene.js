// Compile on the live renderer without leaving asynchronous polling tied to materials
// that a rapid switch can dispose. Three r183 compileAsync polls renderer properties
// after teardown and can throw outside its Promise when currentProgram has disappeared.
// Keep this synchronous until async compilation has explicit material-lifetime ownership.
// This prepares shader variants, NOT every GPU upload or a physically presented frame.
export function compileEnvironmentScene(renderer, scene, camera) {
  const hidden = []
  scene.traverse(object => {
    if (object.visible === false) { hidden.push(object); object.visible = true }
  })
  try {
    renderer.compile(scene, camera)
  } finally {
    for (const object of hidden) object.visible = false
  }
}
