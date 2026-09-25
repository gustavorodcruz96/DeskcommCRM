/** Bootstrap Icons 1.13.1. Same public props as the previous icon family. */
import { createElement, forwardRef } from "react";
import type { IconProps } from "@phosphor-icons/react";

function bootstrapIcon(name: string, filled: string) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function BootstrapIcon(
    {
      size = 20,
      weight = "regular",
      color = "currentColor",
      mirrored,
      alt,
      children,
      style,
      ...props
    },
    ref,
  ) {
    const label = props["aria-label"] ?? alt;
    return createElement(
      "svg",
      {
        ...props,
        ref,
        width: size,
        height: size,
        viewBox: "0 0 16 16",
        fill: color,
        xmlns: "http://www.w3.org/2000/svg",
        focusable: false,
        "aria-label": label,
        "aria-hidden": props["aria-hidden"] ?? (label ? undefined : true),
        "data-icon-family": "bootstrap",
        style: mirrored ? { ...style, transform: "scaleX(-1)" } : style,
      },
      createElement("use", { href: `/icons/bootstrap.svg#${weight === "fill" ? filled : name}` }),
      children,
    );
  });
  Icon.displayName = `Bootstrap(${name})`;
  return Icon;
}

export const Inbox = bootstrapIcon("whatsapp", "whatsapp");
export const ListChecks = bootstrapIcon("list-check", "list-check");
export const Plugs = bootstrapIcon("plug", "plug-fill");
export const PlugsConnected = bootstrapIcon("plug-fill", "plug-fill");
export const QrCode = bootstrapIcon("qr-code", "qr-code");
export const Kanban = bootstrapIcon("kanban", "kanban-fill");
export const Users = bootstrapIcon("people", "people-fill");
export const UsersThree = bootstrapIcon("people-fill", "people-fill");
export const Storefront = bootstrapIcon("shop", "shop");
export const Robot = bootstrapIcon("robot", "robot");
export const Sparkle = bootstrapIcon("stars", "stars");
export const ShieldCheck = bootstrapIcon("shield-check", "shield-check");
export const Gear = bootstrapIcon("gear", "gear-fill");
export const House = bootstrapIcon("house", "house-fill");
export const Buildings = bootstrapIcon("buildings", "buildings-fill");
export const FlowArrow = bootstrapIcon("diagram-3", "diagram-3-fill");
export const ChatsCircle = bootstrapIcon("chat-dots", "chat-dots-fill");
export const ClipboardText = bootstrapIcon("clipboard", "clipboard-fill");
export const Scales = bootstrapIcon("bank", "bank");
export const Gauge = bootstrapIcon("speedometer2", "speedometer2");
export const WifiSlash = bootstrapIcon("wifi-off", "wifi-off");
export const Clock = bootstrapIcon("clock", "clock-fill");
export const Palette = bootstrapIcon("palette", "palette-fill");
export const Megaphone = bootstrapIcon("megaphone", "megaphone-fill");
export const WifiHigh = bootstrapIcon("wifi", "wifi");
export const Brain = bootstrapIcon("cpu", "cpu-fill");
export const ArrowsClockwise = bootstrapIcon("arrow-repeat", "arrow-repeat");
export const Dot = bootstrapIcon("dot", "dot");
export const ArrowBendUpLeft = bootstrapIcon("reply", "reply-fill");
export const List = bootstrapIcon("list", "list");
export const Bell = bootstrapIcon("bell", "bell-fill");
export const BellSlash = bootstrapIcon("bell-slash", "bell-slash-fill");
export const EnvelopeSimple = bootstrapIcon("envelope", "envelope-fill");
export const PaperPlaneTilt = bootstrapIcon("send", "send-fill");
export const Smiley = bootstrapIcon("emoji-smile", "emoji-smile-fill");
export const Check = bootstrapIcon("check2", "check2");
export const Checks = bootstrapIcon("check2-all", "check2-all");
export const X = bootstrapIcon("x", "x");
export const Plus = bootstrapIcon("plus", "plus");
export const Trash = bootstrapIcon("trash", "trash-fill");
export const PencilSimple = bootstrapIcon("pencil", "pencil-fill");
export const MagnifyingGlass = bootstrapIcon("search", "search");
export const Pause = bootstrapIcon("pause", "pause-fill");
export const Play = bootstrapIcon("play", "play-fill");
export const SkipForward = bootstrapIcon("skip-forward", "skip-forward-fill");
export const Copy = bootstrapIcon("copy", "copy");
export const DownloadSimple = bootstrapIcon("download", "download");
export const Archive = bootstrapIcon("archive", "archive-fill");
export const Globe = bootstrapIcon("globe", "globe");
export const ArrowSquareOut = bootstrapIcon("box-arrow-up-right", "box-arrow-up-right");
export const Tray = bootstrapIcon("inbox", "inbox-fill");
export const CheckCircle = bootstrapIcon("check-circle", "check-circle-fill");
export const Warning = bootstrapIcon("exclamation-triangle", "exclamation-triangle-fill");
export const WarningOctagon = bootstrapIcon("exclamation-octagon", "exclamation-octagon-fill");
export const Info = bootstrapIcon("info-circle", "info-circle-fill");
export const CircleNotch = bootstrapIcon("arrow-repeat", "arrow-repeat");
export const ScalesSimple = bootstrapIcon("bank", "bank");
export const Eye = bootstrapIcon("eye", "eye-fill");
export const EyeSlash = bootstrapIcon("eye-slash", "eye-slash-fill");
export const ChartBar = bootstrapIcon("bar-chart", "bar-chart-fill");
export const ClockCountdown = bootstrapIcon("hourglass-split", "hourglass-split");
export const ChartLineUp = bootstrapIcon("graph-up-arrow", "graph-up-arrow");
export const Lightbulb = bootstrapIcon("lightbulb", "lightbulb-fill");
export const Sun = bootstrapIcon("sun", "sun-fill");
export const Moon = bootstrapIcon("moon", "moon-fill");
export const MonitorPlay = bootstrapIcon("display", "display-fill");
export const ChatCircle = bootstrapIcon("chat", "chat-fill");
export const WhatsappLogo = bootstrapIcon("whatsapp", "whatsapp");
export const InstagramLogo = bootstrapIcon("instagram", "instagram");
export const MessengerLogo = bootstrapIcon("messenger", "messenger");
export const Phone = bootstrapIcon("telephone", "telephone-fill");
export const PhoneIncoming = bootstrapIcon("telephone-inbound", "telephone-inbound-fill");
export const PhoneOutgoing = bootstrapIcon("telephone-outbound", "telephone-outbound-fill");
export const PhoneX = bootstrapIcon("telephone-x", "telephone-x-fill");
export const Paperclip = bootstrapIcon("paperclip", "paperclip");
export const Microphone = bootstrapIcon("mic", "mic-fill");
export const MicrophoneSlash = bootstrapIcon("mic-mute", "mic-mute-fill");
export const ImageIcon = bootstrapIcon("image", "image-fill");
export const ImageSquare = bootstrapIcon("image", "image-fill");
export const MusicNote = bootstrapIcon("music-note", "music-note");
export const Note = bootstrapIcon("sticky", "sticky-fill");
export const FileText = bootstrapIcon("file-text", "file-text-fill");
export const Lock = bootstrapIcon("lock", "lock-fill");
export const LockOpen = bootstrapIcon("unlock", "unlock-fill");
export const Receipt = bootstrapIcon("receipt", "receipt");
export const Tag = bootstrapIcon("tag", "tag-fill");
export const Question = bootstrapIcon("question-circle", "question-circle-fill");
export const Keyboard = bootstrapIcon("keyboard", "keyboard-fill");
export const GitBranch = bootstrapIcon("git", "git");
export const Flag = bootstrapIcon("flag", "flag-fill");
export const TreeStructure = bootstrapIcon("diagram-3", "diagram-3-fill");
export const DotsThree = bootstrapIcon("three-dots", "three-dots");
export const CaretDown = bootstrapIcon("chevron-down", "chevron-down");
export const CaretUp = bootstrapIcon("chevron-up", "chevron-up");
export const CaretDoubleLeft = bootstrapIcon("chevron-double-left", "chevron-double-left");
export const CaretDoubleRight = bootstrapIcon("chevron-double-right", "chevron-double-right");
export const CaretLeft = bootstrapIcon("chevron-left", "chevron-left");
export const CaretRight = bootstrapIcon("chevron-right", "chevron-right");
export const ArrowRight = bootstrapIcon("arrow-right", "arrow-right");
export const SignOut = bootstrapIcon("box-arrow-right", "box-arrow-right");
export const WebhooksLogo = bootstrapIcon("broadcast", "broadcast");
export const PuzzlePiece = bootstrapIcon("puzzle", "puzzle-fill");
export const UploadSimple = bootstrapIcon("upload", "upload");
export const Signpost = bootstrapIcon("signpost", "signpost-fill");
export const ArrowCircleUp = bootstrapIcon("arrow-up-circle", "arrow-up-circle-fill");
export const Funnel = bootstrapIcon("funnel", "funnel-fill");
export const BookOpen = bootstrapIcon("book", "book-fill");
export const Key = bootstrapIcon("key", "key-fill");
export const UserCircle = bootstrapIcon("person-circle", "person-circle");
export const ClockCounterClockwise = bootstrapIcon("clock-history", "clock-history");
export const IdentificationCard = bootstrapIcon("person-vcard", "person-vcard-fill");
export const CalendarBlank = bootstrapIcon("calendar", "calendar-fill");
export const CalendarDots = bootstrapIcon("calendar-week", "calendar-week-fill");
export const CalendarPlus = bootstrapIcon("calendar-plus", "calendar-plus-fill");
export const CalendarX = bootstrapIcon("calendar-x", "calendar-x-fill");
export const CalendarCheck = bootstrapIcon("calendar-check", "calendar-check-fill");
export const GoogleLogo = bootstrapIcon("google", "google");
export const MapPin = bootstrapIcon("geo-alt", "geo-alt-fill");
export const ArrowsOutSimple = bootstrapIcon("arrows-fullscreen", "arrows-fullscreen");
