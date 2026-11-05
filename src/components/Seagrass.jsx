import { useEffect, useMemo } from 'react'
import { SWAY_TIME, useSwayClock } from '../utils/coralSway'
import { createSeagrass } from './seagrassGeometry'

export default function Seagrass({ landscape, rocks }) {
  useSwayClock()
  const meadow = useMemo(() => createSeagrass(landscape, rocks, SWAY_TIME), [landscape, rocks])
  useEffect(() => () => meadow.dispose(), [meadow])
  return <group dispose={null}>{meadow.meshes.map(mesh => <primitive key={mesh.name} object={mesh} />)}</group>
}
