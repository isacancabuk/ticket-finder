export function buildNotificationDecision(result) {
  if (result.errorCategory) {
    return { shouldNotify: false, reason: "HAS_ERROR" };
  }

  if (result.previousIsAvailable === false && result.currentIsAvailable === true) {
    return { shouldNotify: true, reason: "BECAME_AVAILABLE" };
  }

  return { shouldNotify: false, reason: null };
}
