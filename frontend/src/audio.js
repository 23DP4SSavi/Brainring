import { ref } from 'vue'

export function useAlarmSound() {
  const ready = ref(false)
  const ringing = ref(false)
  const oscillators = new Set()
  let context, timer
  async function unlock() {
    try {
      if (!context) {
        context = new (window.AudioContext || window.webkitAudioContext)()
        context.onstatechange = () => {
          ready.value = context.state === 'running'
        }
      }
      await context.resume()
      ready.value = context.state === 'running'
      return ready.value
    } catch {
      ready.value = false
      return false
    }
  }
  function pulse() {
    if (!context || context.state !== 'running') {
      ready.value = false
      return
    }
    for (let i = 0; i < 4; i++) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const at = context.currentTime + i * 0.17
      oscillator.type = 'sine'
      oscillator.frequency.value = i % 2 ? 1046 : 784
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.16, at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.14)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillators.add(oscillator)
      oscillator.start(at)
      oscillator.stop(at + 0.16)
      oscillator.onended = () => {
        oscillators.delete(oscillator)
        oscillator.disconnect()
        gain.disconnect()
      }
    }
  }
  function start() {
    if (ringing.value) return
    ringing.value = true
    pulse()
    timer = window.setInterval(pulse, 1300)
  }
  function stop() {
    clearInterval(timer)
    ringing.value = false
    for (const oscillator of oscillators) {
      try {
        oscillator.stop()
      } catch {
        /* Already stopped. */
      }
    }
    oscillators.clear()
  }
  async function enable() {
    await unlock()
    if (ringing.value) pulse()
  }
  function dispose() {
    stop()
    context?.close()
  }
  return { ready, ringing, unlock, enable, start, stop, dispose }
}
