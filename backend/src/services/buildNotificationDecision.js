export function buildNotificationDecision(result) {
  if (result.errorCategory) {
    return { shouldNotify: false, reason: "HAS_ERROR" };
  }

  // Price exceeded is not actionable — do not notify
  if (result.priceExceeded) {
    return { shouldNotify: false, reason: "PRICE_EXCEEDED" };
  }

  if (result.previousIsAvailable === false && result.currentIsAvailable === true) {
    return { shouldNotify: true, reason: "BECAME_AVAILABLE" };
  }

  return { shouldNotify: false, reason: null };
}
