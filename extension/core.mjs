export function mapBounds(bounds, layout, width, height, videoAspect = 16 / 9) {
  const videoW = Math.min(width, height * videoAspect), videoH = videoW / videoAspect;
  const videoX = (width - videoW) / 2, videoY = (height - videoH) / 2;
  const sourceW = 1 - layout.cropLeft - layout.cropRight, sourceH = 1 - layout.cropTop - layout.cropBottom;
  const left = Math.max(0, (bounds.x - layout.cropLeft) / sourceW);
  const top = Math.max(0, (bounds.y - layout.cropTop) / sourceH);
  const right = Math.min(1, (bounds.x + bounds.w - layout.cropLeft) / sourceW);
  const bottom = Math.min(1, (bounds.y + bounds.h - layout.cropTop) / sourceH);
  if (right <= left || bottom <= top) return null;
  return { x: videoX + (layout.x + left * layout.w) * videoW, y: videoY + (layout.y + top * layout.h) * videoH,
    w: (right - left) * layout.w * videoW, h: (bottom - top) * layout.h * videoH };
}
export class FrameBuffer {
  constructor() { this.frames = []; this.revision = 0; this.offsetMs = 0; }
  ingest(data, requestStartedAt = Date.now(), receivedAt = Date.now()) {
    if (!Array.isArray(data.frames)) return;
    if (data.revision < this.revision) { this.frames = []; this.revision = 0; }
    this.offsetMs = data.serverTime - (requestStartedAt + receivedAt) / 2;
    const byRevision = new Map(this.frames.map(frame => [frame.revision, frame]));
    for (const frame of data.frames) byRevision.set(frame.revision, frame);
    this.frames = [...byRevision.values()].sort((a, b) => a.revision - b.revision).filter(frame => frame.receivedAt > data.serverTime - 180000).slice(-500);
    this.revision = Math.max(this.revision, data.revision || 0);
  }
  select(now = Date.now(), latencyMs = 0, adjustmentMs = 0) {
    const target = now + this.offsetMs - Math.max(0, latencyMs + adjustmentMs);
    const frame = this.frames.findLast(item => item.receivedAt <= target);
    return frame && target - frame.receivedAt < 12000 ? frame : null;
  }
}
