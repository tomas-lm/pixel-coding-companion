import { describe, expect, it } from 'vitest'
import { normalizeProjectChangeRoots, normalizeProjects } from './projects'

describe('normalizeProjectChangeRoots', () => {
  it('falls back to an empty list when roots are missing', () => {
    expect(normalizeProjectChangeRoots(undefined)).toEqual([])
  })

  it('keeps valid roots and removes duplicate paths', () => {
    expect(
      normalizeProjectChangeRoots([
        { id: 'root-1', label: 'Backend', path: '/repo/backend' },
        { id: 'root-2', label: 'Backend duplicate', path: '/repo/backend' },
        { id: 'root-3', path: '  /repo/frontend  ' },
        { id: 'bad', path: '' }
      ])
    ).toEqual([
      { id: 'root-1', label: 'Backend', path: '/repo/backend' },
      { id: 'root-3', path: '/repo/frontend' }
    ])
  })
})

describe('normalizeProjects', () => {
  it('keeps old project configs loadable without change roots', () => {
    expect(
      normalizeProjects([
        {
          color: '#4ea1ff',
          description: 'Main app',
          id: 'project-1',
          name: 'Pixel'
        }
      ])
    ).toEqual([
      {
        changeRoots: [],
        color: '#4ea1ff',
        description: 'Main app',
        id: 'project-1',
        name: 'Pixel'
      }
    ])
  })
})
