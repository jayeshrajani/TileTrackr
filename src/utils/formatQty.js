/**
 * Format a decimal box quantity into "X boxes, Y pieces" when applicable.
 * If piecesPerBox is not available or qty is a whole number, returns plain "X unit" format.
 *
 * @param {number} boxes - The quantity in boxes (may be decimal)
 * @param {number|null} piecesPerBox - How many pieces per box (from package_spec)
 * @param {string} unit - The unit name (e.g. 'box')
 * @returns {string} Formatted display string
 */
export function formatQty(boxes, piecesPerBox, unit = 'box') {
  if (boxes == null || isNaN(boxes)) return '0 ' + pluralize(unit)

  const totalBoxes = Number(boxes)
  const wholeBoxes = Math.floor(totalBoxes)
  const fractional = totalBoxes - wholeBoxes

  const unitPlural = pluralize(unit)

  // If no pieces_per_box info or quantity is a whole number, display normally
  if (!piecesPerBox || piecesPerBox <= 0 || fractional < 0.0001) {
    const display = Number.isInteger(totalBoxes) ? totalBoxes : totalBoxes.toFixed(2)
    return `${display} ${totalBoxes === 1 ? unit : unitPlural}`
  }

  // Break fractional into pieces
  const pieces = Math.round(fractional * piecesPerBox)

  if (wholeBoxes === 0) {
    return `${pieces} pc${pieces !== 1 ? 's' : ''}`
  }

  if (pieces === 0) {
    return `${wholeBoxes} ${wholeBoxes === 1 ? unit : unitPlural}`
  }

  return `${wholeBoxes} ${wholeBoxes === 1 ? unit : unitPlural}, ${pieces} pc${pieces !== 1 ? 's' : ''}`
}

function pluralize(unit) {
  if (!unit) return 'boxes'
  if (unit.endsWith('s')) return unit
  if (unit === 'box') return 'boxes'
  return unit + 's'
}
