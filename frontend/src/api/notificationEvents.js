export const NOTIFICATIONS_CHANGED = 'novelhub:notifications-changed'

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
}
