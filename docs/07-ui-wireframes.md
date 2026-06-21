# UI Wireframes (Text-Based) & Interaction Spec

Visual design system: Material UI component primitives + Tailwind for layout/spacing utility classes, dark/light theme via MUI's theming with a shared design-token file (`colors.ts`, `typography.ts`, `spacing.ts`) consumed by both. These wireframes describe structure and behavior — pixel-perfect visual design is a Figma deliverable outside this text spec, but every screen's functional layout and shortcut map is authoritative here.

## 1. POS Terminal (primary screen)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Branch: Main Store ▾   Cashier: J.Doe   [🔍 Search/Barcode............] [⚙] │
├───────────────┬───────────────────────────────────────┬─────────────────────────────┤
│ CATEGORIES    │  PRODUCT GRID                          │  CART                       │
│ ▸ All          │  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │  Customer: [Walk-in ▾]      │
│ ▸ Beverages    │  │img │ │img │ │img │ │img │           │  ───────────────────────── │
│ ▸ Snacks       │  │Name│ │Name│ │Name│ │Name│           │  2x Coke 500ml      $3.00  │
│ ▸ Dairy        │  │$1.0│ │$2.5│ │$0.8│ │$4.2│           │     [-][2][+]  disc 🏷      │
│ ▸ Bakery       │  └────┘ └────┘ └────┘ └────┘           │  1x White Bread     $1.20  │
│ ★ Favorites    │  (virtualized grid, paginated)         │     [-][1][+]  disc 🏷      │
│                │                                          │  ───────────────────────── │
│                │                                          │  Subtotal          $4.20  │
│                │                                          │  Discount         -$0.00  │
│                │                                          │  Tax                $0.21 │
│                │                                          │  GRAND TOTAL        $4.41 │
│                │                                          │  ───────────────────────── │
│                │                                          │  [Hold] [Resume] [Discount]│
├───────────────┴───────────────────────────────────────┴─────────────────────────────┤
│ [💰 Cash F5] [💳 Card F6] [🏦 Bank F7] [📱 Wallet F8] [Credit Sale F9] [Return F10]   │
│ [Hold F2] [Resume F3] [Void] [Open Drawer F4]                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Behavior notes:
- Barcode input field is *always* focus-trapped back to the search box after any modal closes, so a scan never has to be "clicked into."
- Cart line discount (🏷) opens an inline popover, not a full modal — keeps the cashier's flow uninterrupted.
- Stock badge on each grid tile (green/amber/red dot) reflects `stock_levels` in real time via a local WebSocket/SSE channel from the Branch API (not polling).

## 2. Payment Dialog

```
┌───────────────────────────────────────────┐
│  Payment                              [X] │
│  Grand Total:                  $4.41      │
│ ───────────────────────────────────────── │
│  Method: [Cash] [Card] [Bank] [Wallet]    │
│          [Credit] [Mixed]                  │
│                                             │
│  Received Amount:  [ 5.00          ]      │
│  Change:            $0.59                  │
│                                             │
│  + Add another payment (mixed)             │
│                                             │
│           [Cancel]      [Complete Sale]    │
└───────────────────────────────────────────┘
```
Numeric keypad overlay available for touch-screen terminals; physical-keyboard numeric entry works without it. "Mixed" reveals a running list of split-payment rows with a live remaining-balance indicator until it reaches zero, at which point "Complete Sale" enables.

## 3. Hold / Resume Invoice List

```
┌───────────────────────────────────────────┐
│  Held Invoices                             │
│  ───────────────────────────────────────── │
│  #H-0042   Table 3        $12.50   [Resume]│
│  #H-0041   Walk-in        $4.41    [Resume]│
│  #H-0039   J. Smith       $88.00   [Resume]│
└───────────────────────────────────────────┘
```

## 4. Return Invoice Flow

```
Step 1: Lookup            Step 2: Select Lines           Step 3: Refund Method
┌─────────────────┐       ┌──────────────────────┐        ┌─────────────────────┐
│ Invoice #/Cust/  │  →    │ ☑ 2x Coke   refund:2 │   →    │ Refund to: Cash      │
│ Date range search│       │ ☐ 1x Bread  refund:0 │        │ Amount: $3.00        │
└─────────────────┘       └──────────────────────┘        └─────────────────────┘
```

## 5. Dashboard (Analytics)

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Today's Sales: $1,204   Today's Profit: $312   Low Stock: 7 items  [🔔3] │
├───────────────────────────────┬────────────────────────────────────────────┤
│  Sales Trend (30d)  [chart]   │  Top Products            │ Top Customers   │
│                                │  1. Coke 500ml  120 units│ 1. ABC Traders  │
│                                │  2. Bread       95 units │ 2. J. Smith     │
├───────────────────────────────┴───────────────────────────────────────────┤
│  Outstanding Receivables: $4,300     Outstanding Payables: $2,100         │
└───────────────────────────────────────────────────────────────────────────┘
```
Widgets are individually plugin-extensible drop-in slots (see [06-plugin-architecture.md](06-plugin-architecture.md) §3 `DashboardWidget` extension point) — e.g. an "AI Analytics" plugin adds a forecast widget into this same grid.

## 6. Settings — Navigation Shell

Left nav groups: Company Profile, Tax & Currency, Users & Roles, Printers, Barcode, Backup, Notifications, Plugins, Subscription. Each section is a standard MUI form layout (label-above-field, grouped in `Card` sections, sticky save bar at the bottom-right of the content pane).

## 7. Keyboard Shortcut Map (global, customizable in Settings)

| Key | Action |
|---|---|
| F2 | Hold current invoice |
| F3 | Resume invoice list |
| F4 | Open cash drawer |
| F5 | Cash payment |
| F6 | Card payment |
| F7 | Bank transfer payment |
| F8 | Mobile wallet payment |
| F9 | Credit sale |
| F10 | Return invoice |
| Esc | Close active modal / clear search |
| Ctrl+P | Reprint last receipt |

## 8. Theming

Light/Dark mode toggle in the top app bar, persisted per-user (electron-store, §[04-electron-architecture.md](04-electron-architecture.md) §5). Color tokens chosen for WCAG AA contrast in both modes; POS grid and cart retain identical layout across themes — only color tokens change, never structure, so muscle memory transfers.

## 9. Responsiveness

Primary target is fixed desktop/POS-terminal resolutions (1366×768 and up); layout uses CSS grid with min/max constraints rather than a mobile-first breakpoint system, since this is a desktop EXE, not a responsive web app — "Responsive Layout" in the master spec is interpreted here as "adapts gracefully across common desktop/touch-monitor resolutions," not phone-sized viewports (those are served by the future companion mobile app, a separate UI built against the same API).
