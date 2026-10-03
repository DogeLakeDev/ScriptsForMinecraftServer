/** 环形墙钟采样；未获得有效时间跨度时返回未知，避免冷启动伪报 20 TPS。 */
export class TickSampler {
  private samples: number[] = [];
  private cursor = 0;
  push(time: number): void {
    const last = this.samples[(this.cursor + this.samples.length - 1) % this.samples.length];
    if (!Number.isFinite(time) || (last !== undefined && time <= last)) this.reset();
    if (this.samples.length < 100) this.samples.push(time);
    else this.samples[this.cursor] = time;
    this.cursor = (this.cursor + 1) % 100;
  }
  current(): number | null {
    const count = this.samples.length;
    if (count < 2) return null;
    const first = this.samples[count < 100 ? 0 : this.cursor]!;
    const last = this.samples[(this.cursor + count - 1) % count]!;
    const span = last - first;
    return span > 0 ? Math.round(Math.min(20, ((count - 1) * 1000) / span) * 100) / 100 : null;
  }
  reset(): void {
    this.samples = [];
    this.cursor = 0;
  }
}
