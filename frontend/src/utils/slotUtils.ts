/**
 * Utility functions for slot formatting, availability and past-time detection.
 */

export const isSlotExpiredOrPast = (
  dateStr: string,
  slotTimeStr: string,
  slotStatus?: string,
  bufferMinutes: number = 0
): boolean => {
  // If backend explicitly marked it as expired or past
  if (slotStatus === 'expired' || slotStatus === 'past') {
    return true;
  }

  if (!dateStr || !slotTimeStr) return false;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // If the selected date is strictly before today
  if (dateStr < todayStr) {
    return true;
  }

  // If the selected date is today, compare slot time to current local time
  if (dateStr === todayStr) {
    const parts = slotTimeStr.split(':');
    if (parts.length >= 2) {
      const slotH = parseInt(parts[0], 10);
      const slotM = parseInt(parts[1], 10);
      const slotDate = new Date(year, now.getMonth(), now.getDate(), slotH, slotM, 0);

      // If slot time has already passed (or is within bufferMinutes)
      const cutoff = new Date(now.getTime() - bufferMinutes * 60000);
      if (slotDate <= cutoff) {
        return true;
      }
    }
  }

  return false;
};
