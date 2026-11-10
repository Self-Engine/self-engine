// The icons of the app, named by meaning. A new icon is one line here plus its import, and one
// entry in the name list of index.test.ts. Every import comes from Phosphor's per-icon entry:
// the barrel file would load more than 1,500 icons.

import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { FoldersIcon } from "@phosphor-icons/react/dist/csr/Folders";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { ListChecksIcon } from "@phosphor-icons/react/dist/csr/ListChecks";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneRight";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { SidebarSimpleIcon } from "@phosphor-icons/react/dist/csr/SidebarSimple";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { WalletIcon } from "@phosphor-icons/react/dist/csr/Wallet";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { catalogIcon } from "./catalog-icon.ts";

export const ProjectsIcon = catalogIcon(FoldersIcon);
export const TimeIcon = catalogIcon(ClockIcon);
export const FinanceIcon = catalogIcon(WalletIcon);
export const CalendarIcon = catalogIcon(CalendarBlankIcon);
export const HabitsIcon = catalogIcon(ListChecksIcon);
export const SettingsIcon = catalogIcon(GearIcon);
export const AddIcon = catalogIcon(PlusIcon);
export const SearchIcon = catalogIcon(MagnifyingGlassIcon);
export const CloseIcon = catalogIcon(XIcon);
export const SendIcon = catalogIcon(PaperPlaneRightIcon);
export const AssistantIcon = catalogIcon(SparkleIcon);
export const SidePanelIcon = catalogIcon(SidebarSimpleIcon);
export const ErrorIcon = catalogIcon(WarningCircleIcon);
