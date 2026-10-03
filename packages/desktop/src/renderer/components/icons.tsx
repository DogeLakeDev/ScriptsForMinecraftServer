/**
 * icons.tsx — 桌面端统一图标入口（基于 Phosphor Icons，MIT 许可；SnowUI 设计稿同样使用 Phosphor）
 *
 * 使用场景：导航、按钮、状态、空状态等所有图标位都通过 <Icon name="…" /> 引用。
 * 页面只依赖这里的语义名称（如 "warning"、"restart"），不直接依赖 Phosphor 的具体组件名（DIP），
 * 更换图标或升级图标库时只需修改 ICONS 映射；新增图标在 ICONS 中注册一项即可（OCP）。
 * 每个图标按子路径单独导入（@phosphor-icons/react/<Name>），避免开发服务器加载整个图标库。
 */
import type { Icon as PhosphorIcon, IconWeight } from "@phosphor-icons/react";
import { ArchiveIcon } from "@phosphor-icons/react/Archive";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise";
import { ArrowDownIcon } from "@phosphor-icons/react/ArrowDown";
import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/ArrowsClockwise";
import { BellIcon } from "@phosphor-icons/react/Bell";
import { BroadcastIcon } from "@phosphor-icons/react/Broadcast";
import { BugIcon } from "@phosphor-icons/react/Bug";
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { CaretUpDownIcon } from "@phosphor-icons/react/CaretUpDown";
import { ChatCircleIcon } from "@phosphor-icons/react/ChatCircle";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { CircleIcon } from "@phosphor-icons/react/Circle";
import { CircleHalfIcon } from "@phosphor-icons/react/CircleHalf";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { ClockIcon } from "@phosphor-icons/react/Clock";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/ClockCounterClockwise";
import { CodeIcon } from "@phosphor-icons/react/Code";
import { CommandIcon } from "@phosphor-icons/react/Command";
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { CpuIcon } from "@phosphor-icons/react/Cpu";
import { CubeIcon } from "@phosphor-icons/react/Cube";
import { DatabaseIcon } from "@phosphor-icons/react/Database";
import { DotsThreeIcon } from "@phosphor-icons/react/DotsThree";
import { DownloadSimpleIcon } from "@phosphor-icons/react/DownloadSimple";
import { EraserIcon } from "@phosphor-icons/react/Eraser";
import { EyeIcon } from "@phosphor-icons/react/Eye";
import { FileCodeIcon } from "@phosphor-icons/react/FileCode";
import { FolderOpenIcon } from "@phosphor-icons/react/FolderOpen";
import { FunnelIcon } from "@phosphor-icons/react/Funnel";
import { GearSixIcon } from "@phosphor-icons/react/GearSix";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { HardDriveIcon } from "@phosphor-icons/react/HardDrive";
import { HardDrivesIcon } from "@phosphor-icons/react/HardDrives";
import { ImageIcon } from "@phosphor-icons/react/Image";
import { InfoIcon } from "@phosphor-icons/react/Info";
import { KeyIcon } from "@phosphor-icons/react/Key";
import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { LinkIcon } from "@phosphor-icons/react/Link";
import { ListBulletsIcon } from "@phosphor-icons/react/ListBullets";
import { ListChecksIcon } from "@phosphor-icons/react/ListChecks";
import { LockIcon } from "@phosphor-icons/react/Lock";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import { MinusIcon } from "@phosphor-icons/react/Minus";
import { MonitorIcon } from "@phosphor-icons/react/Monitor";
import { MoonIcon } from "@phosphor-icons/react/Moon";
import { PackageIcon } from "@phosphor-icons/react/Package";
import { PencilSimpleIcon } from "@phosphor-icons/react/PencilSimple";
import { PlayIcon } from "@phosphor-icons/react/Play";
import { PlugIcon } from "@phosphor-icons/react/Plug";
import { PlugsIcon } from "@phosphor-icons/react/Plugs";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { PowerIcon } from "@phosphor-icons/react/Power";
import { PulseIcon } from "@phosphor-icons/react/Pulse";
import { PuzzlePieceIcon } from "@phosphor-icons/react/PuzzlePiece";
import { RobotIcon } from "@phosphor-icons/react/Robot";
import { RocketLaunchIcon } from "@phosphor-icons/react/RocketLaunch";
import { ShieldCheckIcon } from "@phosphor-icons/react/ShieldCheck";
import { ShieldWarningIcon } from "@phosphor-icons/react/ShieldWarning";
import { SidebarSimpleIcon } from "@phosphor-icons/react/SidebarSimple";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/SlidersHorizontal";
import { SparkleIcon } from "@phosphor-icons/react/Sparkle";
import { SquaresFourIcon } from "@phosphor-icons/react/SquaresFour";
import { StackIcon } from "@phosphor-icons/react/Stack";
import { StopIcon } from "@phosphor-icons/react/Stop";
import { SunIcon } from "@phosphor-icons/react/Sun";
import { TerminalWindowIcon } from "@phosphor-icons/react/TerminalWindow";
import { TextAlignLeftIcon } from "@phosphor-icons/react/TextAlignLeft";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { UploadSimpleIcon } from "@phosphor-icons/react/UploadSimple";
import { UserIcon } from "@phosphor-icons/react/User";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { XIcon } from "@phosphor-icons/react/X";
import { XCircleIcon } from "@phosphor-icons/react/XCircle";
import { useId, type CSSProperties } from "react";

/** 语义名称 → Phosphor 图标组件 */
const ICONS = {
  overview: SquaresFourIcon,
  terminal: TerminalWindowIcon,
  modules: PuzzlePieceIcon,
  sliders: SlidersHorizontalIcon,
  package: PackageIcon,
  users: UsersThreeIcon,
  user: UserIcon,
  refresh: ArrowsClockwiseIcon,
  history: ClockCounterClockwiseIcon,
  tasks: ListChecksIcon,
  archiveRestore: ArrowCounterClockwiseIcon,
  search: MagnifyingGlassIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  x: XIcon,
  check: CheckIcon,
  chevronDown: CaretDownIcon,
  chevronRight: CaretRightIcon,
  chevronsUpDown: CaretUpDownIcon,
  arrowRight: ArrowRightIcon,
  arrowDown: ArrowDownIcon,
  play: PlayIcon,
  stop: StopIcon,
  restart: ArrowClockwiseIcon,
  power: PowerIcon,
  monitor: MonitorIcon,
  server: HardDrivesIcon,
  globe: GlobeIcon,
  database: DatabaseIcon,
  message: ChatCircleIcon,
  bot: RobotIcon,
  cube: CubeIcon,
  plug: PlugIcon,
  unplug: PlugsIcon,
  warning: WarningIcon,
  alert: WarningCircleIcon,
  info: InfoIcon,
  checkCircle: CheckCircleIcon,
  xCircle: XCircleIcon,
  circle: CircleIcon,
  loader: CircleNotchIcon,
  clock: ClockIcon,
  copy: CopyIcon,
  download: DownloadSimpleIcon,
  upload: UploadSimpleIcon,
  trash: TrashIcon,
  pencil: PencilSimpleIcon,
  more: DotsThreeIcon,
  external: ArrowSquareOutIcon,
  sun: SunIcon,
  moon: MoonIcon,
  system: CircleHalfIcon,
  settings: GearSixIcon,
  command: CommandIcon,
  wrap: TextAlignLeftIcon,
  eraser: EraserIcon,
  folder: FolderOpenIcon,
  key: KeyIcon,
  shield: ShieldCheckIcon,
  shieldAlert: ShieldWarningIcon,
  cpu: CpuIcon,
  activity: PulseIcon,
  archive: ArchiveIcon,
  fileCode: FileCodeIcon,
  sparkles: SparkleIcon,
  rocket: RocketLaunchIcon,
  link: LinkIcon,
  zap: LightningIcon,
  hardDrive: HardDriveIcon,
  code: CodeIcon,
  list: ListBulletsIcon,
  layers: StackIcon,
  image: ImageIcon,
  lock: LockIcon,
  eye: EyeIcon,
  filter: FunnelIcon,
  bell: BellIcon,
  bug: BugIcon,
  broadcast: BroadcastIcon,
  panel: SidebarSimpleIcon,
} satisfies Record<string, PhosphorIcon>;

/** 已注册的图标名称 */
export type IconName = keyof typeof ICONS;

/** 图标字重：regular 用于常规界面，duotone 用于侧栏导航（SnowUI 规范），fill 用于选中/状态强调 */
export type IconTone = Extract<IconWeight, "regular" | "duotone" | "fill" | "bold">;

/**
 * 图标组件。
 * @param size 像素尺寸，默认 16（SnowUI 中按钮/列表内图标为 16，导航为 20）
 * @param weight 字重，默认 regular
 * @param spin 是否旋转（用于加载中）
 * @param mirrored 是否水平镜像（例如右侧栏开关图标）
 */
export function Icon({ name, size = 16, weight = "regular", spin, mirrored, className, style }: { name: IconName; size?: number; weight?: IconTone; spin?: boolean; mirrored?: boolean; className?: string; style?: CSSProperties }) {
  const Glyph = ICONS[name];
  return <Glyph className={`icon${spin ? " icon-spin" : ""}${className ? ` ${className}` : ""}`} size={size} weight={weight} mirrored={mirrored} aria-hidden="true" focusable="false" style={style} />;
}

/**
 * 品牌标识：等轴方块（呼应 Minecraft），单色主题下跟随主色（浅色为近黑底白块，深色为薰衣草底深块）。
 * 使用场景：侧边栏品牌位、欢迎页主视觉、关于对话框。
 * 颜色由 CSS 类 logo-bg / logo-face 读取主题变量，避免在 SVG 属性中写死色值。
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="SFMC" role="img" className="logo-mark">
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect width="32" height="32" rx="9" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect className="logo-bg" width="32" height="32" />
        <path className="logo-face" d="M16 7.2 23.8 11.6 16 16 8.2 11.6Z" fillOpacity=".96" />
        <path className="logo-face" d="M8.2 11.6 16 16v8.8l-7.8-4.4Z" fillOpacity=".62" />
        <path className="logo-face" d="M23.8 11.6 16 16v8.8l7.8-4.4Z" fillOpacity=".3" />
      </g>
    </svg>
  );
}
