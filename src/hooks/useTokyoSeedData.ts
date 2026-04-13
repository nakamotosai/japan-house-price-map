import { useEffect, useState } from 'react'
import { loadHazards, loadSchools, loadStations } from '../lib/dataLoader'
import type { TokyoSeedData } from '../types'

type TokyoSeedState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TokyoSeedData }

export function useTokyoSeedData(): TokyoSeedState {
  const [state, setState] = useState<TokyoSeedState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const [stations, schools, hazards] = await Promise.all([
          loadStations(),
          loadSchools(),
          loadHazards(),
        ])

        if (!cancelled) {
          setState({
            status: 'ready',
            data: { stations, schools, hazards },
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'unknown_error',
          })
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
