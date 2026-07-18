import { ReactNode } from "react";
import {
  Shield, Home as HomeIcon, Package, Users as UsersIcon, UserCheck, PhoneCall,
  Car, Heart, Globe,
} from "lucide-react";

export interface MegaMenuCategory {
  title: string;
  icon: ReactNode;
  color: string;
  bot: string;
  subcategories: string[];
}

export interface MenuItem {
  name: string;
  href: string;
  icon: ReactNode;
  isMega?: boolean;
}

/** Product categories shown in the desktop mega-menu dropdown. */
export const megaMenuCategories: MegaMenuCategory[] = [
  {
    title: "Motor Insurance",
    icon: <Car className="w-5 h-5" />,
    color: "text-cyan-400 border-cyan-400/20 bg-cyan-500/10",
    bot: "Alex",
    subcategories: [
      "Private Car", "Two Wheeler", "Passenger Carrying Vehicle",
      "Goods Carrying Vehicle", "Miscellaneous Vehicle", "Commercial Vehicle"
    ]
  },
  {
    title: "Health Insurance",
    icon: <Heart className="w-5 h-5" />,
    color: "text-purple-400 border-purple-500/20 bg-purple-500/10",
    bot: "Sarah",
    subcategories: [
      "Individual Health Insurance", "Family Floater Insurance", "Senior Citizen Insurance",
      "Critical Illness Insurance", "Maternity Insurance", "Group Health Insurance",
      "Personal Accident Cover", "Top-Up Health Insurance", "Disease Specific Insurance", "Cashless Health Insurance"
    ]
  },
  {
    title: "Travel Insurance",
    icon: <Globe className="w-5 h-5" />,
    color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    bot: "Ethan",
    subcategories: [
      "Domestic Travel Insurance", "International Travel Insurance", "Student Travel Insurance",
      "Family Travel Insurance", "Business Travel Insurance", "Senior Citizen Travel Insurance",
      "Single Trip Insurance", "Multi Trip Insurance"
    ]
  },
  {
    title: "Home & Property",
    icon: <HomeIcon className="w-5 h-5" />,
    color: "text-amber-400 border-amber-500/20 bg-amber-500/10",
    bot: "Emma",
    subcategories: [
      "Home Structure Insurance", "Home Content Insurance", "Property Insurance",
      "Fire Insurance", "Natural Disaster Insurance", "Tenant Insurance",
      "Landlord Insurance", "Office Property Insurance"
    ]
  },
  {
    title: "Miscellaneous",
    icon: <Shield className="w-5 h-5" />,
    color: "text-rose-400 border-rose-500/20 bg-rose-500/10",
    bot: "Alex",
    subcategories: [
      "Pet Insurance", "Cyber Insurance", "Mobile Insurance",
      "Jewellery Insurance", "Crop Insurance", "Marine Insurance",
      "Event Insurance", "Liability Insurance", "Electronic Equipment Insurance"
    ]
  }
];

/** Items in the secondary navigation row. */
export const menuItems: MenuItem[] = [
  { name: "Home", href: "/", icon: <HomeIcon className="w-4 h-4" /> },
  { name: "Products", href: "/policies", icon: <Package className="w-4 h-4" />, isMega: true },
  { name: "About Us", href: "/about", icon: <UsersIcon className="w-4 h-4" /> },
  { name: "Agent Details", href: "/agents", icon: <UserCheck className="w-4 h-4" /> },
  { name: "Contact Us", href: "/contact", icon: <PhoneCall className="w-4 h-4" /> }
];
