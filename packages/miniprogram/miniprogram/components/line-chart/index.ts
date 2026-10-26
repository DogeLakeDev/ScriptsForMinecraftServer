/**
 * line-chart — 折线图（canvas 2d）
 *
 * 使用场景：总览页的 TPS、在线玩家、内存与实体趋势。不引入图表库。
 * series 每项为 { name, color, axis, times, values }；values 中的 null 表示断开。
 * 未提供 times 时仍按点序号等距（兼容只传 values 的旧调用）。
 * min / max 都为 0 时纵轴按数据自适应，且底边不低于 0；否则使用给定范围（含 min 为 0）。
 * 右轴（axis 为 1）始终按自身数据自适应，避免和左轴的固定范围挤在一起。
 * 点按或滑动时在图上钉一条竖线，并在图下读出该时刻的数值。
 */
import { formatMemoryMb, pad } from "../../core/format";

/** 一条曲线 */
interface Series {
  name?: string;
  color: string;
  /** 0 左轴，1 右轴 */
  axis?: 0 | 1;
  times?: number[];
  values: (number | null)[];
}

/** 纵轴范围 */
interface Scale {
  low: number;
  high: number;
}

/** 画布上的一个采样点。value 为 null 时只占位，用来断开前后线段。 */
interface Plotted {
  x: number;
  y: number;
  t: number;
  value: number | null;
}

/** 最近一次绘制的坐标系，供触控把手指位置换算成时间 */
interface Plot {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  begin: number;
  end: number;
  left: Scale;
  /** 有右轴系列时才存在 */
  right: Scale | null;
  rows: { name: string; color: string; points: Plotted[] }[];
}

/** 组件实例上的绘制状态，不放进 data，避免触控时把坐标系来回 setData */
interface ChartRuntime {
  plot: Plot | null;
  /** 用户点按后钉住的时间；数据刷新后重绘仍保留竖线 */
  cursor: number | null;
  /** 丢弃已经过期的画布查询，避免慢返回覆盖新的一帧 */
  ticket: number;
}

const runtimes = new WeakMap<object, ChartRuntime>();

function runtimeOf(host: object): ChartRuntime {
  let runtime = runtimes.get(host);
  if (!runtime) {
    runtime = { plot: null, cursor: null, ticket: 0 };
    runtimes.set(host, runtime);
  }
  return runtime;
}

/** 本组件用到的 canvas 2d 上下文（小程序 getContext 的类型是 any） */
interface Context2D {
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  lineJoin: string;
  lineCap: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  scale(x: number, y: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  setLineDash(segments: number[]): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  stroke(): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
}

/** 1-2-5 刻度步长，使纵轴标签落在整齐的数字上 */
function niceStep(rough: number): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const factor = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
  return factor * power;
}

/** 纵轴刻度文字。内存用紧凑的 G/M，避免把绘图区挤没。 */
function axisLabel(value: number, unit: string): string {
  if (unit === "memory") {
    if (value === 0) return "0";
    if (value >= 1024) {
      const gb = value / 1024;
      return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)}G`;
    }
    return `${Math.round(value)}M`;
  }
  if (unit === "tps") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (unit === "percent") return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
  return String(Math.round(value));
}

/** 读数用完整单位，与顶部状态条的内存 / CPU 文案一致 */
function readoutValue(value: number, unit: string): string {
  if (unit === "memory") return formatMemoryMb(value);
  if (unit === "tps") return value.toFixed(2);
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return String(Math.round(value));
}

/** 轴上的时刻。跨度达到一天时带上月/日，短窗口只显示时分。 */
function axisClock(time: number, withDate: boolean): string {
  const date = new Date(time);
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return withDate ? `${date.getMonth() + 1}/${date.getDate()} ${clock}` : clock;
}

/** 点按读数带秒，方便在 15 分钟窗口里区分相邻采样 */
function readoutClock(time: number, withDate: boolean): string {
  const date = new Date(time);
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return withDate ? `${date.getMonth() + 1}/${date.getDate()} ${clock}` : clock;
}

/** 纵轴上要画标签的数值：两端加上大约四等分的整齐刻度 */
function tickValues(low: number, high: number, unit: string): number[] {
  const span = high - low;
  if (!(span > 0)) return [low];
  const step = unit === "count" || unit === "tps" ? Math.max(1, niceStep(span / 4)) : niceStep(span / 4);
  const ticks = [low];
  const start = Math.ceil((low + step * 0.05) / step) * step;
  for (let value = start; value < high - step * 0.2 && ticks.length < 6; value += step) ticks.push(value);
  ticks.push(high);
  return ticks;
}

/** 按数据自适应，底边不低于 0。没有数值时返回 null。 */
function autoScale(values: number[]): Scale | null {
  if (!values.length) return null;
  let low = Math.min(0, ...values);
  let high = Math.max(...values);
  if (high - low < 1e-6) {
    high += 1;
    low = Math.max(0, low - 1);
  }
  return { low, high };
}

/** 使用调用方给定的范围。跨度为 0 时略微张开，避免除零。 */
function fixedScale(min: number, max: number): Scale {
  let low = min;
  let high = max;
  if (high - low < 1e-6) {
    high += 1;
    low = Math.max(0, low - 1);
  }
  return { low, high };
}

/** 相邻有效点间隔的中位数。只有一个点时不限制命中距离。 */
function neighborGap(points: Plotted[]): number {
  const times = points.filter((point) => point.value !== null).map((point) => point.t);
  if (times.length < 2) return Infinity;
  const deltas = times
    .slice(1)
    .map((time, index) => time - times[index]!)
    .filter((delta) => delta > 0)
    .sort((left, right) => left - right);
  const step = deltas[Math.floor((deltas.length - 1) / 2)];
  return step === undefined ? Infinity : Math.max(step * 1.5, 1);
}

Component({
  properties: {
    series: { type: Array, value: [] as Series[] },
    min: { type: Number, value: 0 },
    max: { type: Number, value: 0 },
    /** tps / count / memory / percent，决定刻度与读数的格式 */
    unit: { type: String, value: "" },
    /** 时间窗左端（毫秒）。与 end 一起决定横轴，不随抽样变形。 */
    begin: { type: Number, value: 0 },
    end: { type: Number, value: 0 },
    height: { type: Number, value: 112 },
  },
  data: {
    /** 点按后的一行读数；空字符串时不占位 */
    readout: "",
  },
  observers: {
    "series, min, max, unit, begin, end, height"() {
      this.draw();
    },
  },
  lifetimes: {
    ready() {
      this.draw();
    },
    detached() {
      runtimes.delete(this);
    },
  },
  methods: {
    /** 手指位置换算成时间并重绘竖线。clientX 相对视口，要减去画布左边距。 */
    onTouch(event: WechatMiniprogram.TouchEvent) {
      const touch = event.touches[0];
      if (!touch || !runtimeOf(this).plot) return;
      this.createSelectorQuery()
        .select("#chart")
        .boundingClientRect((rect) => {
          if (!rect) return;
          this.placeCursor(touch.clientX - rect.left);
        })
        .exec();
    },
    placeCursor(x: number) {
      const runtime = runtimeOf(this);
      const plot = runtime.plot;
      if (!plot || plot.end <= plot.begin) return;
      const plotW = plot.width - plot.padL - plot.padR;
      if (!(plotW > 0)) return;
      const ratio = (x - plot.padL) / plotW;
      if (ratio < -0.05 || ratio > 1.05) return;
      runtime.cursor = plot.begin + Math.min(1, Math.max(0, ratio)) * (plot.end - plot.begin);
      this.draw();
    },
    draw() {
      const runtime = runtimeOf(this);
      const ticket = ++runtime.ticket;
      this.createSelectorQuery()
        .select("#chart")
        .fields({ node: true, size: true })
        .exec((result) => {
          if (ticket !== runtime.ticket) return;
          const target = result?.[0] as { node?: WechatMiniprogram.Canvas; width: number; height: number } | undefined;
          if (!target?.node || !target.width) return;
          const { node: canvas, width, height } = target;
          const ratio = wx.getWindowInfo().pixelRatio;
          canvas.width = width * ratio;
          canvas.height = height * ratio;
          const context = canvas.getContext("2d") as Context2D;
          context.scale(ratio, ratio);
          context.clearRect(0, 0, width, height);
          const model = this.layout(width, height);
          runtime.plot = model;
          if (!model) {
            this.setReadout("");
            return;
          }
          this.paint(context, model, runtime.cursor);
        });
    },

    /** 计算坐标范围与每个采样点的像素位置。没有可画的范围时返回 null。 */
    layout(width: number, height: number): Plot | null {
      const series = (this.data.series as Series[]).filter((row) => row.values.some((value) => value !== null));
      const leftValues = series.filter((row) => (row.axis ?? 0) !== 1).flatMap((row) => row.values.filter((value): value is number => value !== null));
      const rightValues = series.filter((row) => row.axis === 1).flatMap((row) => row.values.filter((value): value is number => value !== null));
      const max = Number(this.data.max) || 0;
      const min = Number(this.data.min) || 0;
      const left = max > 0 ? fixedScale(min, max) : autoScale(leftValues.length ? leftValues : rightValues);
      if (!left) return null;
      const right = leftValues.length && rightValues.length ? autoScale(rightValues) : null;
      const padL = 32;
      const padR = right ? 32 : 4;
      const padT = 8;
      const padB = 16;
      let begin = Number(this.data.begin) || 0;
      let end = Number(this.data.end) || 0;
      const timed = series.some((row) => (row.times?.length ?? 0) === row.values.length && row.values.length > 0);
      if (!(end > begin)) {
        if (!timed) {
          begin = 0;
          end = Math.max(...series.map((row) => row.values.length - 1), 1);
        } else {
          const times = series.flatMap((row) => row.times ?? []);
          begin = Math.min(...times);
          end = Math.max(...times);
        }
      }
      if (!(end > begin)) return null;
      const plotBottom = height - padB;
      const yOf = (value: number, scale: Scale) => plotBottom - ((value - scale.low) / (scale.high - scale.low)) * (plotBottom - padT);
      const xOf = (time: number) => padL + ((time - begin) / (end - begin)) * (width - padL - padR);
      const rows = series.map((row) => {
        const useTime = timed && (row.times?.length ?? 0) === row.values.length;
        const scale = row.axis === 1 && right ? right : left;
        const points: Plotted[] = row.values.map((value, index) => {
          const time = useTime ? row.times![index]! : index;
          return { t: time, value, x: xOf(time), y: value === null ? 0 : yOf(value, scale) };
        });
        return { name: row.name || "", color: row.color, points };
      });
      return { width, height, padL, padR, padT, padB, begin, end, left, right, rows };
    },

    paint(context: Context2D, plot: Plot, cursor: number | null) {
      const unit = String(this.data.unit || "");
      const dark = wx.getAppBaseInfo().theme === "dark";
      const label = dark ? "rgba(226,226,226,0.55)" : "rgba(28,28,28,0.45)";
      const grid = dark ? "rgba(226,226,226,0.1)" : "rgba(28,28,28,0.08)";
      const plotBottom = plot.height - plot.padB;
      const yOf = (value: number, scale: Scale) => plotBottom - ((value - scale.low) / (scale.high - scale.low)) * (plotBottom - plot.padT);
      context.font = "10px sans-serif";
      context.fillStyle = label;
      context.textBaseline = "middle";
      this.paintAxisLabels(context, plot, plot.left, unit, yOf, "left", label, grid);
      if (plot.right) this.paintAxisLabels(context, plot, plot.right, unit, yOf, "right", label, grid);
      const withDate = plot.end - plot.begin >= 24 * 60 * 60_000;
      context.setLineDash([]);
      context.fillStyle = label;
      context.textBaseline = "bottom";
      context.textAlign = "left";
      context.fillText(axisClock(plot.begin, withDate), plot.padL, plot.height - 1);
      context.textAlign = "right";
      context.fillText(axisClock(plot.end, withDate), plot.width - plot.padR, plot.height - 1);
      if (plot.width - plot.padL - plot.padR >= 200) {
        context.textAlign = "center";
        context.fillText(axisClock(plot.begin + (plot.end - plot.begin) / 2, withDate), (plot.padL + plot.width - plot.padR) / 2, plot.height - 1);
      }
      for (const row of plot.rows) {
        context.strokeStyle = row.color;
        context.fillStyle = row.color;
        context.lineWidth = 1.5;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.beginPath();
        let drawing = false;
        for (const point of row.points) {
          if (point.value === null) {
            drawing = false;
            continue;
          }
          if (drawing) context.lineTo(point.x, point.y);
          else context.moveTo(point.x, point.y);
          drawing = true;
        }
        context.stroke();
        row.points.forEach((point, index) => {
          if (point.value === null) return;
          const previous = row.points[index - 1];
          const next = row.points[index + 1];
          if ((previous && previous.value !== null) || (next && next.value !== null)) return;
          context.beginPath();
          context.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
          context.fill();
        });
      }
      if (cursor !== null && cursor >= plot.begin && cursor <= plot.end) {
        const x = plot.padL + ((cursor - plot.begin) / (plot.end - plot.begin)) * (plot.width - plot.padL - plot.padR);
        context.strokeStyle = dark ? "rgba(226,226,226,0.45)" : "rgba(28,28,28,0.35)";
        context.lineWidth = 1;
        context.setLineDash([]);
        context.beginPath();
        context.moveTo(x, plot.padT);
        context.lineTo(x, plotBottom);
        context.stroke();
      }
      this.setReadout(this.readoutAt(plot, cursor, unit, withDate));
    },

    /** 一侧纵轴的网格与标签。左右两侧共用，避免各写一遍刻度过滤。 */
    paintAxisLabels(
      context: Context2D,
      plot: Plot,
      scale: Scale,
      unit: string,
      yOf: (value: number, scale: Scale) => number,
      side: "left" | "right",
      label: string,
      grid: string,
    ) {
      context.lineWidth = 0.5;
      context.strokeStyle = grid;
      context.fillStyle = label;
      let lastY = -999;
      for (const tick of tickValues(scale.low, scale.high, unit)) {
        const y = yOf(tick, scale);
        if (side === "left") {
          context.setLineDash([3, 3]);
          context.beginPath();
          context.moveTo(plot.padL, y);
          context.lineTo(plot.width - plot.padR, y);
          context.stroke();
        }
        if (Math.abs(y - lastY) < 12) continue;
        lastY = y;
        const textY = Math.min(plot.height - plot.padB - 6, Math.max(plot.padT, y));
        if (side === "left") {
          context.textAlign = "left";
          context.fillText(axisLabel(tick, unit), 0, textY);
        } else {
          context.textAlign = "right";
          context.fillText(axisLabel(tick, unit), plot.width, textY);
        }
      }
    },

    /** 取游标时刻附近各条曲线的值。离得超过该曲线自身间隔的一半以上就显示破折号，避免把断线两侧连成一个读数。 */
    readoutAt(plot: Plot, cursor: number | null, unit: string, withDate: boolean): string {
      if (cursor === null) return "";
      const parts: string[] = [];
      let snapped = cursor;
      let best = Infinity;
      for (const row of plot.rows) {
        for (const point of row.points) {
          if (point.value === null) continue;
          const distance = Math.abs(point.t - cursor);
          if (distance < best) {
            best = distance;
            snapped = point.t;
          }
        }
      }
      for (const row of plot.rows) {
        let nearest: Plotted | null = null;
        let distance = Infinity;
        for (const point of row.points) {
          if (point.value === null) continue;
          const gap = Math.abs(point.t - snapped);
          if (gap < distance) {
            distance = gap;
            nearest = point;
          }
        }
        const text = nearest && nearest.value !== null && distance <= neighborGap(row.points) ? readoutValue(nearest.value, unit) : "—";
        parts.push(row.name ? `${row.name} ${text}` : text);
      }
      return parts.length ? `${readoutClock(snapped, withDate)}  ${parts.join("  ")}` : "";
    },
    setReadout(text: string) {
      if (this.data.readout !== text) this.setData({ readout: text });
    },
  },
});
