/**
 * icons.tsx — 桌面端统一图标入口（基于 Tabler Icons，MIT 许可）
 *
 * 使用场景：导航、按钮、状态、空状态等所有图标位都通过 <Icon name="…" /> 引用。
 * 页面只依赖这里的语义名称（如 "warning"、"restart"），不直接依赖 Tabler 的具体组件名（DIP），
 * 更换图标或升级图标库时只需修改 ICONS 映射；新增图标在 ICONS 中注册一项即可（OCP）。
 * 每个图标按文件单独导入（@tabler/icons-react/dist/esm/icons/<Name>.mjs），避免开发服务器加载整个图标库；
 * 这些路径没有逐个的类型声明，统一由 tabler-icons.d.ts 声明。
 * 小程序 scripts/build-assets.mjs 会解析 ICONS 表，取每项的描边组件生成遮罩图标，改表时保持「名称: [描边, 实心?]」的写法。
 */
/// <reference path="./tabler-icons.d.ts" />
import type { TablerIcon } from "@tabler/icons-react";
import IconActivity from "@tabler/icons-react/dist/esm/icons/IconActivity.mjs";
import IconAdjustmentsHorizontal from "@tabler/icons-react/dist/esm/icons/IconAdjustmentsHorizontal.mjs";
import IconAdjustmentsHorizontalFilled from "@tabler/icons-react/dist/esm/icons/IconAdjustmentsHorizontalFilled.mjs";
import IconAlertCircle from "@tabler/icons-react/dist/esm/icons/IconAlertCircle.mjs";
import IconAlertCircleFilled from "@tabler/icons-react/dist/esm/icons/IconAlertCircleFilled.mjs";
import IconAlertTriangle from "@tabler/icons-react/dist/esm/icons/IconAlertTriangle.mjs";
import IconAlertTriangleFilled from "@tabler/icons-react/dist/esm/icons/IconAlertTriangleFilled.mjs";
import IconAppWindow from "@tabler/icons-react/dist/esm/icons/IconAppWindow.mjs";
import IconAppWindowFilled from "@tabler/icons-react/dist/esm/icons/IconAppWindowFilled.mjs";
import IconArchive from "@tabler/icons-react/dist/esm/icons/IconArchive.mjs";
import IconArchiveFilled from "@tabler/icons-react/dist/esm/icons/IconArchiveFilled.mjs";
import IconArrowDown from "@tabler/icons-react/dist/esm/icons/IconArrowDown.mjs";
import IconArrowLeft from "@tabler/icons-react/dist/esm/icons/IconArrowLeft.mjs";
import IconArrowRight from "@tabler/icons-react/dist/esm/icons/IconArrowRight.mjs";
import IconArrowUp from "@tabler/icons-react/dist/esm/icons/IconArrowUp.mjs";
import IconArrowsVertical from "@tabler/icons-react/dist/esm/icons/IconArrowsVertical.mjs";
import IconBell from "@tabler/icons-react/dist/esm/icons/IconBell.mjs";
import IconBellFilled from "@tabler/icons-react/dist/esm/icons/IconBellFilled.mjs";
import IconBolt from "@tabler/icons-react/dist/esm/icons/IconBolt.mjs";
import IconBoltFilled from "@tabler/icons-react/dist/esm/icons/IconBoltFilled.mjs";
import IconBroadcast from "@tabler/icons-react/dist/esm/icons/IconBroadcast.mjs";
import IconBug from "@tabler/icons-react/dist/esm/icons/IconBug.mjs";
import IconBugFilled from "@tabler/icons-react/dist/esm/icons/IconBugFilled.mjs";
import IconCalendar from "@tabler/icons-react/dist/esm/icons/IconCalendar.mjs";
import IconCalendarFilled from "@tabler/icons-react/dist/esm/icons/IconCalendarFilled.mjs";
import IconCheck from "@tabler/icons-react/dist/esm/icons/IconCheck.mjs";
import IconCheckFilled from "@tabler/icons-react/dist/esm/icons/IconCheckFilled.mjs";
import IconChevronDown from "@tabler/icons-react/dist/esm/icons/IconChevronDown.mjs";
import IconChevronDownFilled from "@tabler/icons-react/dist/esm/icons/IconChevronDownFilled.mjs";
import IconChevronRight from "@tabler/icons-react/dist/esm/icons/IconChevronRight.mjs";
import IconChevronRightFilled from "@tabler/icons-react/dist/esm/icons/IconChevronRightFilled.mjs";
import IconCircle from "@tabler/icons-react/dist/esm/icons/IconCircle.mjs";
import IconCircleCheck from "@tabler/icons-react/dist/esm/icons/IconCircleCheck.mjs";
import IconCircleCheckFilled from "@tabler/icons-react/dist/esm/icons/IconCircleCheckFilled.mjs";
import IconCircleFilled from "@tabler/icons-react/dist/esm/icons/IconCircleFilled.mjs";
import IconCircleHalf2 from "@tabler/icons-react/dist/esm/icons/IconCircleHalf2.mjs";
import IconCircleX from "@tabler/icons-react/dist/esm/icons/IconCircleX.mjs";
import IconCircleXFilled from "@tabler/icons-react/dist/esm/icons/IconCircleXFilled.mjs";
import IconClick from "@tabler/icons-react/dist/esm/icons/IconClick.mjs";
import IconClickFilled from "@tabler/icons-react/dist/esm/icons/IconClickFilled.mjs";
import IconClock from "@tabler/icons-react/dist/esm/icons/IconClock.mjs";
import IconClockFilled from "@tabler/icons-react/dist/esm/icons/IconClockFilled.mjs";
import IconCode from "@tabler/icons-react/dist/esm/icons/IconCode.mjs";
import IconCommand from "@tabler/icons-react/dist/esm/icons/IconCommand.mjs";
import IconCopy from "@tabler/icons-react/dist/esm/icons/IconCopy.mjs";
import IconCopyFilled from "@tabler/icons-react/dist/esm/icons/IconCopyFilled.mjs";
import IconCpu from "@tabler/icons-react/dist/esm/icons/IconCpu.mjs";
import IconCube from "@tabler/icons-react/dist/esm/icons/IconCube.mjs";
import IconDatabase from "@tabler/icons-react/dist/esm/icons/IconDatabase.mjs";
import IconDatabaseFilled from "@tabler/icons-react/dist/esm/icons/IconDatabaseFilled.mjs";
import IconDeviceDesktop from "@tabler/icons-react/dist/esm/icons/IconDeviceDesktop.mjs";
import IconDeviceDesktopFilled from "@tabler/icons-react/dist/esm/icons/IconDeviceDesktopFilled.mjs";
import IconDots from "@tabler/icons-react/dist/esm/icons/IconDots.mjs";
import IconDotsFilled from "@tabler/icons-react/dist/esm/icons/IconDotsFilled.mjs";
import IconDownload from "@tabler/icons-react/dist/esm/icons/IconDownload.mjs";
import IconDownloadFilled from "@tabler/icons-react/dist/esm/icons/IconDownloadFilled.mjs";
import IconEraser from "@tabler/icons-react/dist/esm/icons/IconEraser.mjs";
import IconExternalLink from "@tabler/icons-react/dist/esm/icons/IconExternalLink.mjs";
import IconExternalLinkFilled from "@tabler/icons-react/dist/esm/icons/IconExternalLinkFilled.mjs";
import IconEye from "@tabler/icons-react/dist/esm/icons/IconEye.mjs";
import IconEyeFilled from "@tabler/icons-react/dist/esm/icons/IconEyeFilled.mjs";
import IconFileCode from "@tabler/icons-react/dist/esm/icons/IconFileCode.mjs";
import IconFileCodeFilled from "@tabler/icons-react/dist/esm/icons/IconFileCodeFilled.mjs";
import IconFilter from "@tabler/icons-react/dist/esm/icons/IconFilter.mjs";
import IconFilterFilled from "@tabler/icons-react/dist/esm/icons/IconFilterFilled.mjs";
import IconFolderOpen from "@tabler/icons-react/dist/esm/icons/IconFolderOpen.mjs";
import IconFolderOpenFilled from "@tabler/icons-react/dist/esm/icons/IconFolderOpenFilled.mjs";
import IconGitBranch from "@tabler/icons-react/dist/esm/icons/IconGitBranch.mjs";
import IconGripVertical from "@tabler/icons-react/dist/esm/icons/IconGripVertical.mjs";
import IconHeading from "@tabler/icons-react/dist/esm/icons/IconHeading.mjs";
import IconHistory from "@tabler/icons-react/dist/esm/icons/IconHistory.mjs";
import IconInfoCircle from "@tabler/icons-react/dist/esm/icons/IconInfoCircle.mjs";
import IconInfoCircleFilled from "@tabler/icons-react/dist/esm/icons/IconInfoCircleFilled.mjs";
import IconKey from "@tabler/icons-react/dist/esm/icons/IconKey.mjs";
import IconKeyFilled from "@tabler/icons-react/dist/esm/icons/IconKeyFilled.mjs";
import IconLayoutGrid from "@tabler/icons-react/dist/esm/icons/IconLayoutGrid.mjs";
import IconLayoutGridFilled from "@tabler/icons-react/dist/esm/icons/IconLayoutGridFilled.mjs";
import IconLayoutSidebar from "@tabler/icons-react/dist/esm/icons/IconLayoutSidebar.mjs";
import IconLayoutSidebarFilled from "@tabler/icons-react/dist/esm/icons/IconLayoutSidebarFilled.mjs";
import IconLink from "@tabler/icons-react/dist/esm/icons/IconLink.mjs";
import IconLinkFilled from "@tabler/icons-react/dist/esm/icons/IconLinkFilled.mjs";
import IconList from "@tabler/icons-react/dist/esm/icons/IconList.mjs";
import IconListCheck from "@tabler/icons-react/dist/esm/icons/IconListCheck.mjs";
import IconListCheckFilled from "@tabler/icons-react/dist/esm/icons/IconListCheckFilled.mjs";
import IconListFilled from "@tabler/icons-react/dist/esm/icons/IconListFilled.mjs";
import IconLoader2 from "@tabler/icons-react/dist/esm/icons/IconLoader2.mjs";
import IconLock from "@tabler/icons-react/dist/esm/icons/IconLock.mjs";
import IconLockFilled from "@tabler/icons-react/dist/esm/icons/IconLockFilled.mjs";
import IconMessageCircle from "@tabler/icons-react/dist/esm/icons/IconMessageCircle.mjs";
import IconMessageCircleFilled from "@tabler/icons-react/dist/esm/icons/IconMessageCircleFilled.mjs";
import IconMinus from "@tabler/icons-react/dist/esm/icons/IconMinus.mjs";
import IconMoon from "@tabler/icons-react/dist/esm/icons/IconMoon.mjs";
import IconMoonFilled from "@tabler/icons-react/dist/esm/icons/IconMoonFilled.mjs";
import IconPackage from "@tabler/icons-react/dist/esm/icons/IconPackage.mjs";
import IconPencil from "@tabler/icons-react/dist/esm/icons/IconPencil.mjs";
import IconPencilFilled from "@tabler/icons-react/dist/esm/icons/IconPencilFilled.mjs";
import IconPhoto from "@tabler/icons-react/dist/esm/icons/IconPhoto.mjs";
import IconPhotoFilled from "@tabler/icons-react/dist/esm/icons/IconPhotoFilled.mjs";
import IconPlayerPlay from "@tabler/icons-react/dist/esm/icons/IconPlayerPlay.mjs";
import IconPlayerPlayFilled from "@tabler/icons-react/dist/esm/icons/IconPlayerPlayFilled.mjs";
import IconPlayerStop from "@tabler/icons-react/dist/esm/icons/IconPlayerStop.mjs";
import IconPlayerStopFilled from "@tabler/icons-react/dist/esm/icons/IconPlayerStopFilled.mjs";
import IconPlug from "@tabler/icons-react/dist/esm/icons/IconPlug.mjs";
import IconPlugOff from "@tabler/icons-react/dist/esm/icons/IconPlugOff.mjs";
import IconPlus from "@tabler/icons-react/dist/esm/icons/IconPlus.mjs";
import IconPlusFilled from "@tabler/icons-react/dist/esm/icons/IconPlusFilled.mjs";
import IconPower from "@tabler/icons-react/dist/esm/icons/IconPower.mjs";
import IconPuzzle from "@tabler/icons-react/dist/esm/icons/IconPuzzle.mjs";
import IconPuzzleFilled from "@tabler/icons-react/dist/esm/icons/IconPuzzleFilled.mjs";
import IconRefresh from "@tabler/icons-react/dist/esm/icons/IconRefresh.mjs";
import IconRepeat from "@tabler/icons-react/dist/esm/icons/IconRepeat.mjs";
import IconRestore from "@tabler/icons-react/dist/esm/icons/IconRestore.mjs";
import IconRobot from "@tabler/icons-react/dist/esm/icons/IconRobot.mjs";
import IconRocket from "@tabler/icons-react/dist/esm/icons/IconRocket.mjs";
import IconRotateClockwise from "@tabler/icons-react/dist/esm/icons/IconRotateClockwise.mjs";
import IconSearch from "@tabler/icons-react/dist/esm/icons/IconSearch.mjs";
import IconSearchFilled from "@tabler/icons-react/dist/esm/icons/IconSearchFilled.mjs";
import IconSelector from "@tabler/icons-react/dist/esm/icons/IconSelector.mjs";
import IconServer from "@tabler/icons-react/dist/esm/icons/IconServer.mjs";
import IconServer2 from "@tabler/icons-react/dist/esm/icons/IconServer2.mjs";
import IconSettings from "@tabler/icons-react/dist/esm/icons/IconSettings.mjs";
import IconSettingsFilled from "@tabler/icons-react/dist/esm/icons/IconSettingsFilled.mjs";
import IconShieldCheck from "@tabler/icons-react/dist/esm/icons/IconShieldCheck.mjs";
import IconShieldCheckFilled from "@tabler/icons-react/dist/esm/icons/IconShieldCheckFilled.mjs";
import IconShieldExclamation from "@tabler/icons-react/dist/esm/icons/IconShieldExclamation.mjs";
import IconSparkles from "@tabler/icons-react/dist/esm/icons/IconSparkles.mjs";
import IconSparklesFilled from "@tabler/icons-react/dist/esm/icons/IconSparklesFilled.mjs";
import IconStack2 from "@tabler/icons-react/dist/esm/icons/IconStack2.mjs";
import IconStack2Filled from "@tabler/icons-react/dist/esm/icons/IconStack2Filled.mjs";
import IconSun from "@tabler/icons-react/dist/esm/icons/IconSun.mjs";
import IconSunFilled from "@tabler/icons-react/dist/esm/icons/IconSunFilled.mjs";
import IconTerminal2 from "@tabler/icons-react/dist/esm/icons/IconTerminal2.mjs";
import IconTextWrap from "@tabler/icons-react/dist/esm/icons/IconTextWrap.mjs";
import IconToggleLeft from "@tabler/icons-react/dist/esm/icons/IconToggleLeft.mjs";
import IconToggleLeftFilled from "@tabler/icons-react/dist/esm/icons/IconToggleLeftFilled.mjs";
import IconTrash from "@tabler/icons-react/dist/esm/icons/IconTrash.mjs";
import IconTrashFilled from "@tabler/icons-react/dist/esm/icons/IconTrashFilled.mjs";
import IconTypography from "@tabler/icons-react/dist/esm/icons/IconTypography.mjs";
import IconUpload from "@tabler/icons-react/dist/esm/icons/IconUpload.mjs";
import IconUser from "@tabler/icons-react/dist/esm/icons/IconUser.mjs";
import IconUserFilled from "@tabler/icons-react/dist/esm/icons/IconUserFilled.mjs";
import IconUsers from "@tabler/icons-react/dist/esm/icons/IconUsers.mjs";
import IconWorld from "@tabler/icons-react/dist/esm/icons/IconWorld.mjs";
import IconWorldFilled from "@tabler/icons-react/dist/esm/icons/IconWorldFilled.mjs";
import IconX from "@tabler/icons-react/dist/esm/icons/IconX.mjs";
import IconXFilled from "@tabler/icons-react/dist/esm/icons/IconXFilled.mjs";
import { useId, type CSSProperties } from "react";

/** 一个语义图标：描边版，以及可选的实心版（Tabler 只为部分图标提供实心版） */
type IconGlyphs = readonly [outline: TablerIcon, filled?: TablerIcon];

/** 语义名称 → Tabler 图标组件（[描边, 实心?]） */
const ICONS = {
  arrowLeft: [IconArrowLeft],
  arrowUp: [IconArrowUp],
  vertical: [IconArrowsVertical],
  cursorClick: [IconClick, IconClickFilled],
  grip: [IconGripVertical],
  fileCode: [IconFileCode, IconFileCodeFilled],
  branch: [IconGitBranch],
  image: [IconPhoto, IconPhotoFilled],
  repeat: [IconRepeat],
  text: [IconTypography],
  heading: [IconHeading],
  toggle: [IconToggleLeft, IconToggleLeftFilled],
  window: [IconAppWindow, IconAppWindowFilled],
  overview: [IconLayoutGrid, IconLayoutGridFilled],
  terminal: [IconTerminal2],
  modules: [IconPuzzle, IconPuzzleFilled],
  sliders: [IconAdjustmentsHorizontal, IconAdjustmentsHorizontalFilled],
  package: [IconPackage],
  users: [IconUsers],
  user: [IconUser, IconUserFilled],
  refresh: [IconRefresh],
  history: [IconHistory],
  tasks: [IconListCheck, IconListCheckFilled],
  archiveRestore: [IconRestore],
  search: [IconSearch, IconSearchFilled],
  plus: [IconPlus, IconPlusFilled],
  minus: [IconMinus],
  x: [IconX, IconXFilled],
  check: [IconCheck, IconCheckFilled],
  chevronDown: [IconChevronDown, IconChevronDownFilled],
  chevronRight: [IconChevronRight, IconChevronRightFilled],
  chevronsUpDown: [IconSelector],
  arrowRight: [IconArrowRight],
  arrowDown: [IconArrowDown],
  play: [IconPlayerPlay, IconPlayerPlayFilled],
  stop: [IconPlayerStop, IconPlayerStopFilled],
  restart: [IconRotateClockwise],
  power: [IconPower],
  monitor: [IconDeviceDesktop, IconDeviceDesktopFilled],
  server: [IconServer],
  globe: [IconWorld, IconWorldFilled],
  database: [IconDatabase, IconDatabaseFilled],
  message: [IconMessageCircle, IconMessageCircleFilled],
  bot: [IconRobot],
  cube: [IconCube],
  plug: [IconPlug],
  unplug: [IconPlugOff],
  warning: [IconAlertTriangle, IconAlertTriangleFilled],
  alert: [IconAlertCircle, IconAlertCircleFilled],
  info: [IconInfoCircle, IconInfoCircleFilled],
  checkCircle: [IconCircleCheck, IconCircleCheckFilled],
  xCircle: [IconCircleX, IconCircleXFilled],
  circle: [IconCircle, IconCircleFilled],
  loader: [IconLoader2],
  clock: [IconClock, IconClockFilled],
  calendar: [IconCalendar, IconCalendarFilled],
  copy: [IconCopy, IconCopyFilled],
  download: [IconDownload, IconDownloadFilled],
  upload: [IconUpload],
  trash: [IconTrash, IconTrashFilled],
  pencil: [IconPencil, IconPencilFilled],
  more: [IconDots, IconDotsFilled],
  external: [IconExternalLink, IconExternalLinkFilled],
  sun: [IconSun, IconSunFilled],
  moon: [IconMoon, IconMoonFilled],
  system: [IconCircleHalf2],
  settings: [IconSettings, IconSettingsFilled],
  command: [IconCommand],
  wrap: [IconTextWrap],
  eraser: [IconEraser],
  folder: [IconFolderOpen, IconFolderOpenFilled],
  key: [IconKey, IconKeyFilled],
  shield: [IconShieldCheck, IconShieldCheckFilled],
  shieldAlert: [IconShieldExclamation],
  cpu: [IconCpu],
  activity: [IconActivity],
  archive: [IconArchive, IconArchiveFilled],
  sparkles: [IconSparkles, IconSparklesFilled],
  rocket: [IconRocket],
  link: [IconLink, IconLinkFilled],
  zap: [IconBolt, IconBoltFilled],
  hardDrive: [IconServer2],
  code: [IconCode],
  list: [IconList, IconListFilled],
  layers: [IconStack2, IconStack2Filled],
  lock: [IconLock, IconLockFilled],
  eye: [IconEye, IconEyeFilled],
  filter: [IconFilter, IconFilterFilled],
  bell: [IconBell, IconBellFilled],
  bug: [IconBug, IconBugFilled],
  broadcast: [IconBroadcast],
  panel: [IconLayoutSidebar, IconLayoutSidebarFilled],
} satisfies Record<string, IconGlyphs>;

/** 已注册的图标名称 */
export type IconName = keyof typeof ICONS;

/**
 * 图标字重：regular 用于常规界面，duotone 用于侧栏导航与空状态，fill 用于选中/状态强调，bold 用于小尺寸对勾等。
 * Tabler 没有双色调，duotone 按常规描边渲染；保留这个取值，调用方不必随图标库改动。
 */
export type IconTone = "regular" | "duotone" | "fill" | "bold";

/** bold 字重的描边宽度（Tabler 默认 2，基于 24 网格随尺寸缩放）；没有实心版的图标在 fill 下也用它表示强调 */
const BOLD_STROKE = 2.5;

/**
 * 图标组件。
 * @param size 像素尺寸，默认 16（按钮/列表内图标为 16，导航为 20）
 * @param weight 字重，默认 regular；fill 优先用实心版，没有实心版时退为加粗描边
 * @param spin 是否旋转（用于加载中）
 * @param mirrored 是否水平镜像（例如右侧栏开关图标）
 */
export function Icon({
  name,
  size = 16,
  weight = "regular",
  spin,
  mirrored,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  weight?: IconTone;
  spin?: boolean;
  mirrored?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const [outline, filled]: IconGlyphs = ICONS[name];
  const Glyph = weight === "fill" && filled ? filled : outline;
  const bold = weight === "bold" || (weight === "fill" && !filled);
  return (
    <Glyph
      className={`icon${spin ? " icon-spin" : ""}${mirrored ? " icon-mirrored" : ""}${className ? ` ${className}` : ""}`}
      size={size}
      stroke={bold ? BOLD_STROKE : undefined}
      aria-hidden="true"
      focusable="false"
      style={style}
    />
  );
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
