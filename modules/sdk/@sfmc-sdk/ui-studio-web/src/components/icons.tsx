/** Studio 的语义图标入口，复用 desktop 的 Phosphor 图标映射。 */
import { Icon, type IconName } from "@sfmc-bds/ui/icons";

export interface UiIconProps {
  size?: number;
  className?: string;
}
export type UiIcon = ((props: UiIconProps) => React.ReactNode) & { iconName: IconName };
const component = (name: IconName): UiIcon =>
  Object.assign((props: UiIconProps) => <Icon name={name} {...props} />, { iconName: name });

export const ArrowLeft = component("arrowLeft");
export const ArrowDown = component("arrowDown");
export const ArrowUp = component("arrowUp");
export const ChevronDown = component("chevronDown");
export const ChevronRight = component("chevronRight");
export const ChevronsUpDown = component("chevronsUpDown");
export const Download = component("download");
export const Upload = component("upload");
export const FolderUp = component("upload");
export const FileUp = component("upload");
export const FolderOpen = component("folder");
export const FilePlus2 = component("plus");
export const FileJson2 = component("fileCode");
export const Pencil = component("pencil");
export const Plus = component("plus");
export const Minus = component("minus");
export const Trash2 = component("trash");
export const Undo2 = component("archiveRestore");
export const RotateCcw = component("archiveRestore");
export const Redo2 = component("restart");
export const Copy = component("copy");
export const Eye = component("eye");
export const AppWindow = component("window");
export const LogIn = component("plug");
export const Package = component("package");
export const Box = component("cube");
export const Monitor = component("monitor");
export const Moon = component("moon");
export const Sun = component("sun");
export const Check = component("check");
export const CheckCircle2 = component("checkCircle");
export const CircleAlert = component("info");
export const AlertTriangle = component("warning");
export const GripVertical = component("grip");
export const Image = component("image");
export const Type = component("heading");
export const ALargeSmall = component("text");
export const Rows3 = component("wrap");
export const BarChart3 = component("sliders");
export const MousePointerClick = component("cursorClick");
export const MoveVertical = component("vertical");
export const Repeat = component("repeat");
export const Split = component("branch");
export const ToggleLeft = component("toggle");
