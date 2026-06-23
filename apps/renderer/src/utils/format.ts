// Converts raw backend enum/status values (snake_case, e.g. "credit_sale",
// "bank_transfer") into human-readable labels ("Credit Sale", "Bank Transfer")
// so the UI never surfaces unexplained machine tokens to the cashier.
export function formatEnumLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
