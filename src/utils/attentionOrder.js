// Where people look first in a grid, as a ranking of its cells.
//
// The model is the inverted L (the F-pattern without its middle bar): on a layout
// of similar-looking items, people read along the top row, then skim down the left
// column, and give the interior and the bottom-right the least attention. Sources:
// TheLadders' recruiter eye-tracking (2012, 2018) and Nielsen Norman Group's
// F-pattern studies (2006, revisited 2017).
//
// Each cell scores on two arms, and keeps the stronger of the two:
//
//   topBar(c, r)   = ACROSS^c * OFF_ARM^r   strong along row 0, fading rightward
//   leftEdge(c, r) = DOWN^r   * OFF_ARM^c   strong down column 0, fading downward
//   score(c, r)    = max(topBar, leftEdge)
//
// c and r are 0-based (A1 = 0,0). OFF_ARM is how steeply attention falls away from
// an arm; it is what makes the shape an L rather than a diagonal gradient (a plain
// ACROSS^c * DOWN^r would rank B2 above E1, which the studies do not support).
//
// With the constants below, a 5×5 grid ranks A1, B1, A2, C1, A3, D1, E1, A4, B2,
// A5, C2, B3 … and ends on E5. In a single column (phones) it reduces to plain
// top-to-bottom order.
//
// These constants are a judgement fitted to the shape of the studies, not measured
// from this app. Replace them if real click data ever says otherwise.
//
// Where the model does not apply:
// - Strong visual hierarchy (one card much bolder than the rest) pulls the eye to
//   it regardless of position. NN/g's 2017 update is explicit about this.
// - Right-to-left reading mirrors it: pass the column index as (columns - 1 - c).
//
// Used by the tank selector to decide which tanks to preload first. The selector
// lays tanks out in TANKS order, so the tank most worth seeing belongs first.
const ACROSS = 0.85
const DOWN = 0.8
const OFF_ARM = 0.55

export function attentionScore(column, row) {
  const topBar = ACROSS ** column * OFF_ARM ** row
  const leftEdge = DOWN ** row * OFF_ARM ** column
  return Math.max(topBar, leftEdge)
}

// Item indices (in layout order, filling rows left to right) sorted from most to
// least attention. Ties keep layout order.
export function attentionOrder(count, columns) {
  const cols = Math.max(1, Math.floor(columns) || 1)
  return Array.from({ length: count }, (_, index) => index)
    .map(index => ({ index, score: attentionScore(index % cols, Math.floor(index / cols)) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.index)
}
