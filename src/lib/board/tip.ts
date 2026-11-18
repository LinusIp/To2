// Where the chalk tip is right now (board coords 1000×625), shared with the 3D tutor's arm IK.
// A plain mutable object read in requestAnimationFrame — no React re-renders.
// `left` = the left edge of the element being written: the tutor stands beside it, not on it.
export const boardTip: { x: number; y: number; left: number; active: boolean; at: number } = { x: 0, y: 0, left: NaN, active: false, at: 0 };

// The board element that was just highlighted (board coords): the tutor points at it.
// `count` goes up by one per highlight, so the tutor reacts once per highlight.
export const boardFocus: { x: number; y: number; count: number } = { x: 0, y: 0, count: 0 };

// The 3D tutor asks the board to wait (hold the chalk) while it turns to the board or walks to a
// stroke it can't reach yet ("walk first, then write"). The lesson timeline freezes while `hold`
// is true. The tutor caps each hold (900 ms) and clears it when it stops rendering.
export const tutorGate: { hold: boolean } = { hold: false };
