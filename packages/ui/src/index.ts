/**
 * The public surface of the design system's components.
 *
 * Apps import from `@aegis/ui` and never from a deep path. That is what makes
 * internal reorganisation possible: as long as this file keeps exporting the
 * same names, moving a component between folders breaks nothing.
 */

// Components
export { Button, type ButtonProps } from "./components/Button";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  type CardProps,
} from "./components/Card";

// Server-safe: usable from server components to style a link like a button.
export { buttonVariants, cardVariants } from "./variants";
export { Input, type InputProps } from "./components/Input";
export { Modal, type ModalProps } from "./components/Modal";
export { Spinner, type SpinnerProps } from "./components/Spinner";
export { Skeleton, SkeletonText, type SkeletonProps } from "./components/Skeleton";
export { Progress, type ProgressProps } from "./components/Progress";
export {
  ToastProvider,
  useToast,
  type Toast as ToastMessage,
  type ToastTone,
} from "./components/Toast";

// Feedback
export { ErrorBoundary } from "./feedback/ErrorBoundary";
export { LoadingScreen, type LoadingScreenProps } from "./feedback/LoadingScreen";

// Layout
export { AppLayout, type AppLayoutProps } from "./layout/AppLayout";
export { Navbar, ThemeToggle, type NavbarProps, type NavItem } from "./layout/Navbar";
export { Footer, type FooterProps, type FooterLink } from "./layout/Footer";

// Providers
export { ThemeProvider, useTheme, themeInitScript } from "./providers/ThemeProvider";
