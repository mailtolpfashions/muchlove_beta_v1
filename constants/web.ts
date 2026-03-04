/**
 * Web-specific design tokens for the admin panel.
 * Extends the shared color/typography system in constants/colors.ts & typography.ts.
 * Import this ONLY in components/web/ and app/(admin)/ — never in mobile screens.
 */

import { Colors } from '@/constants/colors';

// ── Extended palette for web surfaces ────────────────────────

export const WebColors = {
  /** Sidebar */
  sidebarBg: 'rgba(255, 255, 255, 0.82)',
  sidebarBorder: Colors.border,
  sidebarHover: '#FFF0F5',
  sidebarActive: Colors.primaryLight,
  sidebarActiveBorder: Colors.primary,

  /** Top bar */
  topBarBg: '#FFFFFF',
  topBarBorder: '#F1F1F4',

  /** Content area */
  pageBg: '#FAF5F7',
  contentMaxWidth: 1400,

  /** Table */
  tableHeaderBg: '#FAFAFA',
  tableRowAlt: '#FFFAFC',
  tableRowHover: '#FFF0F5',
  tableBorder: '#F3F4F6',

  /** Cards */
  cardHover: 'rgba(233, 30, 99, 0.04)',
  cardShadow: 'rgba(136, 14, 79, 0.06)',

  /** Stat card gradients — [start, end] */
  gradientRevenue: ['#E91E63', '#AD1457'] as const,
  gradientSales: ['#8B5CF6', '#6D28D9'] as const,
  gradientStaff: ['#0EA5E9', '#0284C7'] as const,
  gradientRequests: ['#F59E0B', '#D97706'] as const,

  /** Status badge colors */
  badgePending: { bg: '#FEF3C7', text: '#D97706' },
  badgeApproved: { bg: '#D1FAE5', text: '#059669' },
  badgeRejected: { bg: '#FEE2E2', text: '#DC2626' },

  /** Request type badge colors */
  badgeLeave: { bg: '#FFEDD5', text: '#EA580C' },
  badgeCompLeave: { bg: '#EDE9FE', text: '#7C3AED' },
  badgeEarnedLeave: { bg: '#D1FAE5', text: '#059669' },
  badgePermission: { bg: '#FEF3C7', text: '#D97706' },
  badgeCorrection: { bg: '#DBEAFE', text: '#2563EB' },

  /** Login */
  loginOverlay: 'rgba(136, 14, 79, 0.55)',
} as const;

// ── Web typography (larger than mobile for readability) ──────

export const WebTypo = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,
  table: 14,
  tableHeader: 12,
  button: 14,
  label: 12,
  /** CSS font stack — Inter loaded via Google Fonts <link> in index.html */
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

// ── Layout dimensions ────────────────────────────────────────

export const WebLayout = {
  sidebarWidth: 260,
  sidebarCollapsed: 72,
  topBarHeight: 64,
  contentPadding: 28,
  /** Responsive breakpoints (px) */
  breakXl: 1400,
  breakLg: 1024,
  breakMd: 768,
} as const;

// ── Salon imagery (Unsplash CDN — free to use) ───────────────

export const SalonImages = {
  loginHero: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80',
  dashboardHero: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
  emptyState: 'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=400&q=80',
} as const;

// ── Attendance calendar cell colors ──────────────────────────

export const AttendanceCellColors: Record<string, { bg: string; text: string; label: string }> = {
  present:    { bg: '#D1FAE5', text: '#059669', label: 'P' },
  absent:     { bg: '#FEE2E2', text: '#DC2626', label: 'A' },
  half_day:   { bg: '#FEF3C7', text: '#D97706', label: 'HD' },
  leave:      { bg: '#EDE9FE', text: '#7C3AED', label: 'L' },
  permission: { bg: '#DBEAFE', text: '#2563EB', label: 'PM' },
  weekly_off: { bg: '#F3F4F6', text: '#9CA3AF', label: 'WO' },
  unmarked:   { bg: '#FAFAFA', text: '#D1D5DB', label: '-' },
} as const;
