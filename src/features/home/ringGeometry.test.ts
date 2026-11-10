import { expect, it } from 'vitest'
import { pointAt, sectionPath, sectionHitPolygon, SECTION_ANGLES } from './ringGeometry'
it('keeps cardinal quarter bands, constant eight-unit gaps and the approved radii',()=>{
 expect(SECTION_ANGLES).toEqual([0,90,180,270])
 for(let i=0;i<4;i++){
  const path=sectionPath(i)
  expect(path).toContain('A 192 192');expect(path).toContain('A 128 128')
  const p=pointAt(192,SECTION_ANGLES[i]+45-Math.asin(4/192)*180/Math.PI)
  const q=pointAt(192,SECTION_ANGLES[i]+45+Math.asin(4/192)*180/Math.PI)
  expect(Math.hypot(p.x-q.x,p.y-q.y)).toBeCloseTo(8,8)
  expect(sectionHitPolygon(i)).toMatch(/^polygon\(/)
 }
})
it('uses the financial fraction of each useful angular span, including zero and full completion',()=>{
 for(let i=0;i<4;i++){
  expect(sectionPath(i,0)).toBe('');expect(sectionPath(i,1)).toBe(sectionPath(i))
  const half=sectionPath(i,.5).split(' '), x=Number(half[9]),y=Number(half[10])
  // At half of a symmetrical quarter, the outer endpoint is its cardinal midpoint.
  const p=pointAt(192,SECTION_ANGLES[i]);expect(x).toBeCloseTo(p.x,4);expect(y).toBeCloseTo(p.y,4)
 }
})
