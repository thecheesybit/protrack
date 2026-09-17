import { MonthlyForest } from './MonthlyForest'
import { ForestTerrain } from './ForestTerrain'

export { MonthlyForest, ForestTerrain }

/**
 * ForestView component rendering the complete botanical forest grove.
 */
export function ForestView(props) {
  return <MonthlyForest {...props} />
}

