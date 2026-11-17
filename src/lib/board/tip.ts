// Where the chalk tip is right now (board coords 1000×625), shared with the 3D tutor's arm IK.
// A plain mutable object read in requestAnimationFrame — no React re-renders.
export const boardTip: { x: number; y: number; active: boolean; at: number } = { x: 0, y: 0, active: false, at: 0 };
