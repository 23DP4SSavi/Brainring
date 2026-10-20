export function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
export function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}
export const profileKey = (id) => 'brainring-profile-' + id
export const soundKey = (id, alarmId) => 'brainring-sound-' + id + '-' + alarmId
export function validProfile(profile) {
  return profile.firstName.trim().length > 0 && profile.firstName.trim().length <= 50 &&
    profile.lastName.trim().length > 0 && profile.lastName.trim().length <= 50 &&
    /^[a-zA-Z0-9]{5,25}$/.test(profile.username)
}
