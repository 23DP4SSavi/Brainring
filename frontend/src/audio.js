import { ref } from 'vue'

export function useAlarmSound() {
  const ready = ref(false)
  const ringing = ref(false)
  const oscillators = new Set()
  let context, timer
  let tone = 'classic', volume = 0.8
  function configure(config = {}) {
    tone = ['classic', 'digital', 'bell'].includes(config.tone) ? config.tone : 'classic'
    volume = Math.min(1, Math.max(0.1, Number(config.volume) / 100 || 0.8))
  }
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
      oscillator.type = tone === 'digital' ? 'square' : 'sine'
      oscillator.frequency.value = tone === 'bell' ? (i % 2 ? 1568 : 1175) : (i % 2 ? 1046 : 784)
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime((tone === 'digital' ? 0.12 : 0.2) * volume, at + 0.015)
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
  return { configure, ready, ringing, unlock, enable, start, stop, dispose }
}
