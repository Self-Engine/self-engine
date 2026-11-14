// The directory of pictures: every icon name of the list with the picture it shows (D293). It is
// typed against the list, so a name without a picture, or a picture under no name, is a type
// error. The directory holds 107 Phosphor icons, so it never loads at startup: only `ui` imports
// it (the boundary rule `icon-directory-only-in-ui`), through the mark of
// `@self-engine/ui/entry-mark` and the icon picker of `@self-engine/ui/entry-pickers`, each in a
// View or drawer that loads on demand, and the startup check of the web app fails when startup
// code reaches it. The interface keeps importing its own icons
// one by one from the main entry. A directory for React Native comes with the mobile app, typed
// against the same list.

import { ArchiveIcon } from "@phosphor-icons/react/dist/csr/Archive";
import { BankIcon } from "@phosphor-icons/react/dist/csr/Bank";
import { BarbellIcon } from "@phosphor-icons/react/dist/csr/Barbell";
import { BicycleIcon } from "@phosphor-icons/react/dist/csr/Bicycle";
import { BookOpenTextIcon } from "@phosphor-icons/react/dist/csr/BookOpenText";
import { BrainIcon } from "@phosphor-icons/react/dist/csr/Brain";
import { BriefcaseIcon } from "@phosphor-icons/react/dist/csr/Briefcase";
import { BroomIcon } from "@phosphor-icons/react/dist/csr/Broom";
import { BugIcon } from "@phosphor-icons/react/dist/csr/Bug";
import { BuildingsIcon } from "@phosphor-icons/react/dist/csr/Buildings";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { CarIcon } from "@phosphor-icons/react/dist/csr/Car";
import { ChartBarIcon } from "@phosphor-icons/react/dist/csr/ChartBar";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ChecksIcon } from "@phosphor-icons/react/dist/csr/Checks";
import { CigaretteSlashIcon } from "@phosphor-icons/react/dist/csr/CigaretteSlash";
import { CircleIcon } from "@phosphor-icons/react/dist/csr/Circle";
import { CircleDashedIcon } from "@phosphor-icons/react/dist/csr/CircleDashed";
import { CircleHalfIcon } from "@phosphor-icons/react/dist/csr/CircleHalf";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { ClockCountdownIcon } from "@phosphor-icons/react/dist/csr/ClockCountdown";
import { CloudIcon } from "@phosphor-icons/react/dist/csr/Cloud";
import { CodeIcon } from "@phosphor-icons/react/dist/csr/Code";
import { CoffeeIcon } from "@phosphor-icons/react/dist/csr/Coffee";
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { CookingPotIcon } from "@phosphor-icons/react/dist/csr/CookingPot";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { CurrencyBtcIcon } from "@phosphor-icons/react/dist/csr/CurrencyBtc";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { DesktopTowerIcon } from "@phosphor-icons/react/dist/csr/DesktopTower";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { DeviceMobileSlashIcon } from "@phosphor-icons/react/dist/csr/DeviceMobileSlash";
import { DeviceTabletIcon } from "@phosphor-icons/react/dist/csr/DeviceTablet";
import { DropIcon } from "@phosphor-icons/react/dist/csr/Drop";
import { FilmSlateIcon } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { FireIcon } from "@phosphor-icons/react/dist/csr/Fire";
import { FlaskIcon } from "@phosphor-icons/react/dist/csr/Flask";
import { ForkKnifeIcon } from "@phosphor-icons/react/dist/csr/ForkKnife";
import { GameControllerIcon } from "@phosphor-icons/react/dist/csr/GameController";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { GiftIcon } from "@phosphor-icons/react/dist/csr/Gift";
import { GlobeIcon } from "@phosphor-icons/react/dist/csr/Globe";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { GuitarIcon } from "@phosphor-icons/react/dist/csr/Guitar";
import { HamburgerIcon } from "@phosphor-icons/react/dist/csr/Hamburger";
import { HandCoinsIcon } from "@phosphor-icons/react/dist/csr/HandCoins";
import { HandWavingIcon } from "@phosphor-icons/react/dist/csr/HandWaving";
import { HandsPrayingIcon } from "@phosphor-icons/react/dist/csr/HandsPraying";
import { HandshakeIcon } from "@phosphor-icons/react/dist/csr/Handshake";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { HourglassMediumIcon } from "@phosphor-icons/react/dist/csr/HourglassMedium";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { LaptopIcon } from "@phosphor-icons/react/dist/csr/Laptop";
import { LightbulbIcon } from "@phosphor-icons/react/dist/csr/Lightbulb";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { MailboxIcon } from "@phosphor-icons/react/dist/csr/Mailbox";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/csr/Megaphone";
import { MicrophoneStageIcon } from "@phosphor-icons/react/dist/csr/MicrophoneStage";
import { MoneyIcon } from "@phosphor-icons/react/dist/csr/Money";
import { MoonStarsIcon } from "@phosphor-icons/react/dist/csr/MoonStars";
import { MusicNotesIcon } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { NeedleIcon } from "@phosphor-icons/react/dist/csr/Needle";
import { NotebookIcon } from "@phosphor-icons/react/dist/csr/Notebook";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { PaintBrushIcon } from "@phosphor-icons/react/dist/csr/PaintBrush";
import { PaletteIcon } from "@phosphor-icons/react/dist/csr/Palette";
import { PauseCircleIcon } from "@phosphor-icons/react/dist/csr/PauseCircle";
import { PawPrintIcon } from "@phosphor-icons/react/dist/csr/PawPrint";
import { PenNibIcon } from "@phosphor-icons/react/dist/csr/PenNib";
import { PencilRulerIcon } from "@phosphor-icons/react/dist/csr/PencilRuler";
import { PencilSimpleLineIcon } from "@phosphor-icons/react/dist/csr/PencilSimpleLine";
import { PersonSimpleIcon } from "@phosphor-icons/react/dist/csr/PersonSimple";
import { PersonSimpleRunIcon } from "@phosphor-icons/react/dist/csr/PersonSimpleRun";
import { PersonSimpleTaiChiIcon } from "@phosphor-icons/react/dist/csr/PersonSimpleTaiChi";
import { PersonSimpleWalkIcon } from "@phosphor-icons/react/dist/csr/PersonSimpleWalk";
import { PhoneCallIcon } from "@phosphor-icons/react/dist/csr/PhoneCall";
import { PiggyBankIcon } from "@phosphor-icons/react/dist/csr/PiggyBank";
import { PillIcon } from "@phosphor-icons/react/dist/csr/Pill";
import { PlayCircleIcon } from "@phosphor-icons/react/dist/csr/PlayCircle";
import { ProhibitIcon } from "@phosphor-icons/react/dist/csr/Prohibit";
import { QuestionIcon } from "@phosphor-icons/react/dist/csr/Question";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { RepeatIcon } from "@phosphor-icons/react/dist/csr/Repeat";
import { RocketLaunchIcon } from "@phosphor-icons/react/dist/csr/RocketLaunch";
import { ScissorsIcon } from "@phosphor-icons/react/dist/csr/Scissors";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { ShoppingCartIcon } from "@phosphor-icons/react/dist/csr/ShoppingCart";
import { ShowerIcon } from "@phosphor-icons/react/dist/csr/Shower";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { StopCircleIcon } from "@phosphor-icons/react/dist/csr/StopCircle";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import { SunHorizonIcon } from "@phosphor-icons/react/dist/csr/SunHorizon";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";
import { TelevisionSimpleIcon } from "@phosphor-icons/react/dist/csr/TelevisionSimple";
import { ThumbsUpIcon } from "@phosphor-icons/react/dist/csr/ThumbsUp";
import { TrayIcon } from "@phosphor-icons/react/dist/csr/Tray";
import { VaultIcon } from "@phosphor-icons/react/dist/csr/Vault";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { WifiHighIcon } from "@phosphor-icons/react/dist/csr/WifiHigh";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";
import { XCircleIcon } from "@phosphor-icons/react/dist/csr/XCircle";
import { YarnIcon } from "@phosphor-icons/react/dist/csr/Yarn";
import { type CatalogIcon, catalogIcon } from "../catalog-icon.ts";
import type { IconName } from "../names/index.ts";

export { ICON_LABELS } from "./labels.ts";

/** Each icon name with its picture, drawn like every catalog icon. */
export const ICON_DIRECTORY: Readonly<Record<IconName, CatalogIcon>> = {
  archive: catalogIcon(ArchiveIcon),
  bank: catalogIcon(BankIcon),
  barbell: catalogIcon(BarbellIcon),
  bicycle: catalogIcon(BicycleIcon),
  "book-open-text": catalogIcon(BookOpenTextIcon),
  brain: catalogIcon(BrainIcon),
  briefcase: catalogIcon(BriefcaseIcon),
  broom: catalogIcon(BroomIcon),
  bug: catalogIcon(BugIcon),
  buildings: catalogIcon(BuildingsIcon),
  "calendar-blank": catalogIcon(CalendarBlankIcon),
  camera: catalogIcon(CameraIcon),
  car: catalogIcon(CarIcon),
  "chart-bar": catalogIcon(ChartBarIcon),
  "chart-line-up": catalogIcon(ChartLineUpIcon),
  "check-circle": catalogIcon(CheckCircleIcon),
  checks: catalogIcon(ChecksIcon),
  "cigarette-slash": catalogIcon(CigaretteSlashIcon),
  circle: catalogIcon(CircleIcon),
  "circle-dashed": catalogIcon(CircleDashedIcon),
  "circle-half": catalogIcon(CircleHalfIcon),
  "clipboard-text": catalogIcon(ClipboardTextIcon),
  "clock-countdown": catalogIcon(ClockCountdownIcon),
  cloud: catalogIcon(CloudIcon),
  code: catalogIcon(CodeIcon),
  coffee: catalogIcon(CoffeeIcon),
  coins: catalogIcon(CoinsIcon),
  "cooking-pot": catalogIcon(CookingPotIcon),
  "credit-card": catalogIcon(CreditCardIcon),
  "currency-btc": catalogIcon(CurrencyBtcIcon),
  "currency-dollar": catalogIcon(CurrencyDollarIcon),
  "desktop-tower": catalogIcon(DesktopTowerIcon),
  "device-mobile": catalogIcon(DeviceMobileIcon),
  "device-mobile-slash": catalogIcon(DeviceMobileSlashIcon),
  "device-tablet": catalogIcon(DeviceTabletIcon),
  drop: catalogIcon(DropIcon),
  "film-slate": catalogIcon(FilmSlateIcon),
  fire: catalogIcon(FireIcon),
  flask: catalogIcon(FlaskIcon),
  "fork-knife": catalogIcon(ForkKnifeIcon),
  "game-controller": catalogIcon(GameControllerIcon),
  gear: catalogIcon(GearIcon),
  gift: catalogIcon(GiftIcon),
  globe: catalogIcon(GlobeIcon),
  "graduation-cap": catalogIcon(GraduationCapIcon),
  guitar: catalogIcon(GuitarIcon),
  hamburger: catalogIcon(HamburgerIcon),
  "hand-coins": catalogIcon(HandCoinsIcon),
  "hand-waving": catalogIcon(HandWavingIcon),
  "hands-praying": catalogIcon(HandsPrayingIcon),
  handshake: catalogIcon(HandshakeIcon),
  heart: catalogIcon(HeartIcon),
  "hourglass-medium": catalogIcon(HourglassMediumIcon),
  house: catalogIcon(HouseIcon),
  laptop: catalogIcon(LaptopIcon),
  lightbulb: catalogIcon(LightbulbIcon),
  lightning: catalogIcon(LightningIcon),
  "magnifying-glass": catalogIcon(MagnifyingGlassIcon),
  mailbox: catalogIcon(MailboxIcon),
  megaphone: catalogIcon(MegaphoneIcon),
  "microphone-stage": catalogIcon(MicrophoneStageIcon),
  money: catalogIcon(MoneyIcon),
  "moon-stars": catalogIcon(MoonStarsIcon),
  "music-notes": catalogIcon(MusicNotesIcon),
  needle: catalogIcon(NeedleIcon),
  notebook: catalogIcon(NotebookIcon),
  package: catalogIcon(PackageIcon),
  "paint-brush": catalogIcon(PaintBrushIcon),
  palette: catalogIcon(PaletteIcon),
  "pause-circle": catalogIcon(PauseCircleIcon),
  "paw-print": catalogIcon(PawPrintIcon),
  "pen-nib": catalogIcon(PenNibIcon),
  "pencil-ruler": catalogIcon(PencilRulerIcon),
  "pencil-simple-line": catalogIcon(PencilSimpleLineIcon),
  "person-simple": catalogIcon(PersonSimpleIcon),
  "person-simple-run": catalogIcon(PersonSimpleRunIcon),
  "person-simple-tai-chi": catalogIcon(PersonSimpleTaiChiIcon),
  "person-simple-walk": catalogIcon(PersonSimpleWalkIcon),
  "phone-call": catalogIcon(PhoneCallIcon),
  "piggy-bank": catalogIcon(PiggyBankIcon),
  pill: catalogIcon(PillIcon),
  "play-circle": catalogIcon(PlayCircleIcon),
  prohibit: catalogIcon(ProhibitIcon),
  question: catalogIcon(QuestionIcon),
  receipt: catalogIcon(ReceiptIcon),
  repeat: catalogIcon(RepeatIcon),
  "rocket-launch": catalogIcon(RocketLaunchIcon),
  scissors: catalogIcon(ScissorsIcon),
  "shield-check": catalogIcon(ShieldCheckIcon),
  "shopping-cart": catalogIcon(ShoppingCartIcon),
  shower: catalogIcon(ShowerIcon),
  sparkle: catalogIcon(SparkleIcon),
  star: catalogIcon(StarIcon),
  "stop-circle": catalogIcon(StopCircleIcon),
  sun: catalogIcon(SunIcon),
  "sun-horizon": catalogIcon(SunHorizonIcon),
  target: catalogIcon(TargetIcon),
  "television-simple": catalogIcon(TelevisionSimpleIcon),
  "thumbs-up": catalogIcon(ThumbsUpIcon),
  tray: catalogIcon(TrayIcon),
  vault: catalogIcon(VaultIcon),
  wallet: catalogIcon(WalletIcon),
  "warning-circle": catalogIcon(WarningCircleIcon),
  "wifi-high": catalogIcon(WifiHighIcon),
  wrench: catalogIcon(WrenchIcon),
  "x-circle": catalogIcon(XCircleIcon),
  yarn: catalogIcon(YarnIcon),
};
