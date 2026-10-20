<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { api } from './api'
import { useAlarmSound } from './audio'

const theme = ref(document.documentElement.dataset.theme || 'light')
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.value === 'dark' ? '#111111' : '#f5f5f5')
  try { localStorage.setItem('brainring-theme', theme.value) } catch { /* Storage is optional. */ }
}
const user = ref(null)
const view = ref('login')
const booting = ref(true)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const remember = ref(true)
const alarms = ref([])
const challenge = ref(null)
const wrongAnswer = ref(null)
const answerError = ref('')
const sound = useAlarmSound()
const soundReady = sound.ready
const dialog = ref(null)
const editingId = ref(null)
const form = ref({
  time: '07:00',
  days: [1, 2, 3, 4, 5],
  mode: 'hard',
  label: '',
  enabled: true,
})
const formError = ref('')
const now = ref(new Date())
let clockTimer
let triggerPending = false
const firedThisSession = new Set()
const weekdays = [
  { id: 1, short: 'M', name: 'Monday' },
  { id: 2, short: 'T', name: 'Tuesday' },
  { id: 3, short: 'W', name: 'Wednesday' },
  { id: 4, short: 'T', name: 'Thursday' },
  { id: 5, short: 'F', name: 'Friday' },
  { id: 6, short: 'S', name: 'Saturday' },
  { id: 0, short: 'S', name: 'Sunday' },
]
const modeName = (mode) =>
  ({ easy: 'Easy', medium: 'Medium', hard: 'Hard' })[mode]
function timeParts(time) {
  const [hour, minute] = time.split(':').map(Number)
  return {
    time: `${hour % 12 || 12}:${String(minute).padStart(2, '0')}`,
    period: hour >= 12 ? 'PM' : 'AM',
  }
}
function repeatLabel(days) {
  if (!days.length) return 'Once'
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  if (days.length === 7) return 'Every day'
  if ([1, 2, 3, 4, 5].every((day) => days.includes(day)) && days.length === 5)
    return 'Mon–Fri'
  if (days.length === 2 && days.includes(0) && days.includes(6))
    return 'Weekend'
  return weekdays
    .filter((day) => days.includes(day.id))
    .map((day) => names[day.id])
    .join(', ')
}
const nextAlarm = computed(() => {
  let next = null
  for (const alarm of alarms.value.filter((item) => item.enabled)) {
    for (let offset = 0; offset < 8; offset++) {
      const candidate = new Date(now.value)
      const [hours, minutes] = alarm.time.split(':').map(Number)
      candidate.setDate(candidate.getDate() + offset)
      candidate.setHours(hours, minutes, 0, 0)
      if (
        candidate <= now.value ||
        (alarm.days.length && !alarm.days.includes(candidate.getDay()))
      )
        continue
      if (!next || candidate < next.date) next = { alarm, date: candidate }
      break
    }
  }
  if (!next) return 'a little quiet for now'
  const minutes = Math.ceil((next.date - now.value) / 60000)
  if (minutes < 60) return `next ring in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `next ring in ${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
})
async function loadAccount() {
  const [saved, active] = await Promise.all([
    api('/alarms'),
    api('/challenges/active'),
  ])
  alarms.value = saved
  challenge.value = active
  if (active) {
    view.value = 'challenge'
    sound.start()
  } else view.value = 'home'
}
async function submitAuth() {
  if (busy.value) return
  void sound.unlock()
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await api(
      `/auth/${view.value === 'register' ? 'register' : 'login'}`,
      {
        method: 'POST',
        body: {
          email: email.value,
          password: password.value,
          remember: remember.value,
        },
      },
    )
    user.value = result.user
    view.value = 'home'
    password.value = ''
    await loadAccount()
  } catch (cause) {
    error.value = cause.message
  } finally {
    busy.value = false
  }
}
function switchAuth() {
  view.value = view.value === 'login' ? 'register' : 'login'
  error.value = ''
  notice.value = ''
  password.value = ''
}
async function logout() {
  busy.value = true
  error.value = ''
  try {
    await api('/auth/logout', { method: 'POST' })
    user.value = null
    alarms.value = []
    view.value = 'login'
    sound.stop()
  } catch (cause) {
    error.value = cause.message
  } finally {
    busy.value = false
  }
}
async function saveToggle(alarm) {
  error.value = ''
  busy.value = true
  if (!alarm.enabled) void sound.unlock()
  try {
    const saved = await api(`/alarms/${alarm.id}`, {
      method: 'PUT',
      body: { ...alarm, enabled: !alarm.enabled },
    })
    alarms.value = alarms.value.map((item) =>
      item.id === saved.id ? saved : item,
    )
  } catch (cause) {
    error.value = cause.message
  } finally {
    busy.value = false
  }
}
async function openAlarm(alarm) {
  editingId.value = alarm?.id ?? null
  form.value = alarm
    ? { ...alarm, days: [...alarm.days] }
    : {
        time: '07:00',
        days: [1, 2, 3, 4, 5],
        mode: 'hard',
        label: '',
        enabled: true,
      }
  formError.value = ''
  await nextTick()
  dialog.value.showModal()
}
function toggleDay(day) {
  form.value.days = form.value.days.includes(day)
    ? form.value.days.filter((value) => value !== day)
    : [...form.value.days, day]
}
async function saveAlarm() {
  void sound.unlock()
  busy.value = true
  formError.value = ''
  try {
    const editing = editingId.value !== null
    await api(editing ? `/alarms/${editingId.value}` : '/alarms', {
      method: editing ? 'PUT' : 'POST',
      body: form.value,
    })
    alarms.value = await api('/alarms')
    dialog.value.close()
    notice.value = editing
      ? 'alarm updated. future you says thanks.'
      : 'alarm saved. see you in the morning!'
  } catch (cause) {
    formError.value = cause.message
  } finally {
    busy.value = false
  }
}
async function deleteAlarm() {
  busy.value = true
  formError.value = ''
  try {
    await api(`/alarms/${editingId.value}`, { method: 'DELETE' })
    alarms.value = alarms.value.filter((alarm) => alarm.id !== editingId.value)
    dialog.value.close()
    notice.value = 'alarm deleted.'
  } catch (cause) {
    formError.value = cause.message
  } finally {
    busy.value = false
  }
}
async function ring(alarm = null) {
  if (triggerPending || busy.value || view.value === 'challenge') return false
  triggerPending = true
  busy.value = true
  error.value = ''
  try {
    challenge.value = await api('/challenges', {
      method: 'POST',
      body: alarm ? { alarmId: alarm.id } : { mode: 'hard' },
    })
    wrongAnswer.value = null
    answerError.value = ''
    notice.value = ''
    dialog.value?.close()
    view.value = 'challenge'
    sound.start()
    return true
  } catch (cause) {
    error.value = cause.message
    return false
  } finally {
    triggerPending = false
    busy.value = false
  }
}
function returnHome() {
  view.value = 'home'
  notice.value = ''
}
function ringNow() {
  void sound.unlock()
  void ring()
}
async function answer(index) {
  if (busy.value) return
  busy.value = true
  answerError.value = ''
  try {
    const result = await api(`/challenges/${challenge.value.id}/answer`, {
      method: 'POST',
      body: { answer: index },
    })
    if (result.correct) {
      sound.stop()
      view.value = 'success'
      challenge.value = null
      alarms.value = await api('/alarms')
    } else {
      wrongAnswer.value = index
      answerError.value = 'Incorrect answer. Please try again.'
    }
  } catch (cause) {
    answerError.value = cause.message
  } finally {
    busy.value = false
  }
}
function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
async function tick() {
  now.value = new Date()
  if (
    !user.value ||
    !['home', 'success'].includes(view.value) ||
    busy.value ||
    triggerPending
  )
    return
  const date = now.value
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  for (const alarm of alarms.value) {
    if (
      !alarm.enabled ||
      alarm.time !== time ||
      (alarm.days.length && !alarm.days.includes(date.getDay()))
    )
      continue
    const key = `brainring-fired-${user.value.id}-${alarm.id}`
    const sessionKey = `${key}-${dateKey(date)}`
    let fired
    try {
      fired = localStorage.getItem(key)
    } catch {
      fired = null
    }
    if (fired === dateKey(date) || firedThisSession.has(sessionKey)) continue
    if (await ring(alarm)) {
      firedThisSession.add(sessionKey)
      try {
        localStorage.setItem(key, dateKey(date))
      } catch {
        /* Storage is optional. */
      }
    }
    break
  }
}
onMounted(async () => {
  try {
    const result = await api('/auth/me')
    user.value = result.user
    view.value = 'home'
    await loadAccount()
  } catch (cause) {
    if (cause.status !== 401) error.value = cause.message
  } finally {
    booting.value = false
  }
  clockTimer = window.setInterval(tick, 1000)
})
onUnmounted(() => {
  clearInterval(clockTimer)
  sound.dispose()
})
</script>
<template>
  <div
    class="app-shell"
    :class="{
      'home-shell': user && view === 'home',
      'challenge-shell': view === 'challenge',
    }"
  >
    <div v-if="booting" class="loading-screen" role="status">
      <img
        src="/images/brainring.png"
        alt="BrainRing"
        width="150"
        height="150"
      />
      <p>waking things up…</p>
    </div>
    <template v-else>
      <header class="site-header">
        <a
          class="wordmark"
          href="#"
          @click.prevent="!user ? (view = 'login') : null"
          aria-label="BrainRing"
          >brain<span>ring</span
          ><span class="wordmark-star" aria-hidden="true">✳</span></a
        >
        <span v-if="!user" class="header-note"
          >A clearer start to your day.</span
        >
        <button
          v-else-if="view === 'home'"
          class="text-button signout"
          @click="logout"
          :disabled="busy"
        >
          sign out <span aria-hidden="true">↗</span>
        </button>
        <span v-else class="header-note">Start your day with focus.</span>
        <button
          type="button"
          class="theme-toggle"
          :aria-pressed="theme === 'dark'"
          :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          {{ theme === 'dark' ? 'White mode' : 'Black mode' }}
        </button>
      </header>
      <main v-if="!user" class="auth-stage">
        <div class="auth-card paper-card">
          <img
            class="auth-mascot"
            src="/images/brainring.png"
            alt="BrainRing — a brain in an alarm clock wearing sunglasses"
            width="176"
            height="176"
          />
          <span class="doodle auth-star" aria-hidden="true">✧</span>
          <h1>{{ view === 'register' ? 'Create an account' : 'BrainRing' }}</h1>
          <p class="auth-tagline">
            {{
              view === 'register'
                ? 'Build a more intentional morning routine.'
                : 'the alarm you can’t just snooze'
            }}
          </p>
          <form @submit.prevent="submitAuth" class="auth-form">
            <label class="sr-only" for="email">Your email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="your email"
              maxlength="254"
              required
            />
            <div class="password-field">
              <label class="sr-only" for="password">Password</label>
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="
                  view === 'register' ? 'new-password' : 'current-password'
                "
                :minlength="view === 'register' ? 8 : undefined"
                maxlength="128"
                :placeholder="
                  view === 'register'
                    ? 'password (at least 8 characters)'
                    : 'password'
                "
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                :aria-pressed="showPassword"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
              >
                {{ showPassword ? 'hide' : 'show' }}
              </button>
            </div>
            <div class="auth-options">
              <label class="remember-label"
                ><input v-model="remember" type="checkbox" /><span
                  class="mini-toggle"
                  aria-hidden="true"
                ></span
                ><span>keep me logged in</span></label
              >
              <button
                type="button"
                class="forgot"
                @click="
                  notice =
                    'Password reset isn’t available yet. Keep your password somewhere safe.'
                "
              >
                Forgot password?
              </button>
            </div>
            <p v-if="error" class="message error-message" role="alert">
              {{ error }}
            </p>
            <p v-if="notice" class="message" role="status">{{ notice }}</p>
            <button
              class="button pink-button auth-submit"
              type="submit"
              :disabled="busy"
            >
              {{
                busy
                  ? 'Please wait'
                  : view === 'register'
                    ? 'Create account'
                    : 'Sign in'
              }}
            </button>
          </form>
          <div class="divider"><span>or</span></div>
          <button
            class="button secondary-button"
            @click="switchAuth"
            :disabled="busy"
          >
            {{
              view === 'register'
                ? '↩ Already have an account? Sign in'
                : 'Create an account'
            }}
          </button>
          <svg class="squiggle" viewBox="0 0 112 15" aria-hidden="true">
            <path
              d="M2 8 Q9 0 16 8 T30 8 T44 8 T58 8 T72 8 T86 8 T100 8 T110 8"
            />
          </svg>
        </div>
        <p class="stage-caption">
          A little focus. A better morning. <span aria-hidden="true">☀</span>
        </p>
      </main>
      <main v-else-if="view === 'home'" class="home-stage">
        <div class="home-card paper-card">
          <span class="doodle home-star" aria-hidden="true">✧</span>
          <img
            class="home-mascot"
            src="/images/brainring.png"
            alt="BrainRing"
            width="158"
            height="158"
          />
          <h1 class="sr-only">Your alarms</h1>
          <div class="alarm-list" aria-label="Your alarms">
            <article
              v-for="alarm in alarms"
              :key="alarm.id"
              class="alarm-card"
              :class="{ 'alarm-off': !alarm.enabled }"
            >
              <button
                class="alarm-details"
                @click="openAlarm(alarm)"
                :aria-label="`Edit ${timeParts(alarm.time).time} ${timeParts(alarm.time).period} alarm`"
              >
                <span class="alarm-time"
                  >{{ timeParts(alarm.time).time
                  }}<small>{{ timeParts(alarm.time).period }}</small></span
                >
                <span class="alarm-summary"
                  >{{ repeatLabel(alarm.days) }} ·
                  {{ modeName(alarm.mode) }} mode</span
                >
                <span v-if="alarm.label" class="alarm-label">{{
                  alarm.label
                }}</span>
              </button>
              <button
                class="alarm-toggle"
                :class="{ 'is-on': alarm.enabled }"
                role="switch"
                :aria-checked="alarm.enabled"
                :aria-label="`${alarm.enabled ? 'Turn off' : 'Turn on'} ${timeParts(alarm.time).time} ${timeParts(alarm.time).period} alarm`"
                @click="saveToggle(alarm)"
                :disabled="busy"
              >
                <span></span>
              </button>
            </article>
            <div v-if="!alarms.length" class="empty-state">
              <span aria-hidden="true">☀</span>
              <p>a fresh start.</p>
              <small>add your first alarm below.</small>
            </div>
          </div>
          <button
            class="button add-alarm-button"
            @click="openAlarm()"
            :disabled="busy"
          >
            + add alarm
          </button>
          <button
            class="button pink-button ring-button"
            @click="ringNow"
            :disabled="busy"
          >
            Test alarm <span class="clock-emoji" aria-hidden="true">⏰</span>
          </button>
          <p
            v-if="error"
            class="message error-message home-message"
            role="alert"
          >
            {{ error }}
          </p>
          <p v-if="notice" class="message home-message" role="status">
            {{ notice }}
          </p>
          <svg class="squiggle" viewBox="0 0 112 15" aria-hidden="true">
            <path
              d="M2 8 Q9 0 16 8 T30 8 T44 8 T58 8 T72 8 T86 8 T100 8 T110 8"
            />
          </svg>
        </div>
        <div class="home-footer">
          <p class="next-ring">
            <span class="status-dot"></span>{{ nextAlarm }}
          </p>
          <button class="sound-button" @click="sound.enable()">
            <span aria-hidden="true">{{ soundReady ? '♫' : '♪' }}</span
            >{{ soundReady ? 'sound is ready' : 'tap to enable sound' }}
          </button>
          <p class="browser-note">keep this tab open & your device awake.</p>
        </div>
      </main>
      <main v-else-if="view === 'challenge' && challenge" class="quiz-stage">
        <div class="quiz-card paper-card">
          <svg class="bell-doodle" viewBox="0 0 48 52" aria-hidden="true">
            <path
              d="M12 29c2-4 2-10 3-14 3-12 20-12 23 0 1 5 1 10 4 15l-5 3H13l-4-2zm9 10q5 8 10 0M5 8l5 5M43 6l-4 6"
            />
          </svg>
          <span class="sleep-doodle" aria-hidden="true">zZ</span>
          <span class="doodle quiz-star" aria-hidden="true">✧</span>
          <div class="quiz-topline">
            <span
              >{{ timeParts(challenge.time).time }}
              {{ timeParts(challenge.time).period }}</span
            ><span class="mode-badge">{{ modeName(challenge.mode) }} mode</span>
          </div>
          <div
            class="quiz-picture"
            :class="{ 'math-picture': !challenge.image }"
          >
            <img
              v-if="challenge.image"
              :src="challenge.image"
              alt="A wooden character with large eyes holding a bat outside a hut at night"
              width="320"
              height="320"
            />
            <template v-else
              ><span class="math-spark" aria-hidden="true">✳</span
              ><span>{{ challenge.expression }}</span
              ><small>you’ve got this.</small></template
            >
          </div>
          <h1>{{ challenge.prompt }}</h1>
          <p class="quiz-instructions">
            {{
              challenge.image
                ? 'Select the correct name to dismiss the alarm.'
                : 'Select the correct answer to dismiss the alarm.'
            }}
          </p>
          <button
            v-if="!soundReady"
            class="quiz-sound-prompt"
            @click="sound.enable()"
          >
            ♫ tap to start the alarm sound
          </button>
          <div class="answer-options">
            <button
              v-for="(option, index) in challenge.options"
              :key="index"
              class="answer-button"
              :class="{ 'wrong-answer': wrongAnswer === index }"
              @click="answer(index)"
              :disabled="busy"
            >
              <span class="answer-letter">{{
                String.fromCharCode(65 + index)
              }}</span
              ><span>{{ option }}</span>
            </button>
          </div>
          <p v-if="answerError" class="message quiz-error" role="alert">
            {{ answerError }}
          </p>
        </div>
        <p class="stage-caption">Complete the challenge to dismiss the alarm.</p>
      </main>
      <main v-else-if="view === 'success'" class="success-stage">
        <div class="success-card paper-card">
          <span class="doodle success-spark" aria-hidden="true">✳</span>
          <img
            src="/images/brainring.png"
            alt="BrainRing"
            width="185"
            height="185"
          />
          <p class="eyebrow">CHALLENGE COMPLETE</p>
          <h1>Ready for the day</h1>
          <p>Your alarm has been dismissed.<br />Have a productive morning.</p>
          <button
            class="button pink-button"
            @click="returnHome"
          >
            Back to alarms <span aria-hidden="true">↗</span>
          </button>
          <svg class="squiggle" viewBox="0 0 112 15" aria-hidden="true">
            <path
              d="M2 8 Q9 0 16 8 T30 8 T44 8 T58 8 T72 8 T86 8 T100 8 T110 8"
            />
          </svg>
        </div>
      </main>
      <footer class="site-footer">
        <span>BrainRing</span
        ><span>Wake up with intention <span aria-hidden="true">↗</span></span>
      </footer>
    </template>
    <dialog
      ref="dialog"
      class="alarm-dialog"
      aria-labelledby="alarm-dialog-title"
      @click="
        (event) => {
          if (event.target === dialog && !busy) dialog.close()
        }
      "
      @cancel="
        (event) => {
          if (busy) event.preventDefault()
        }
      "
    >
      <form @submit.prevent="saveAlarm">
        <div class="dialog-heading">
          <h2 id="alarm-dialog-title">
            {{
              editingId !== null ? 'Edit alarm' : 'New alarm'
            }}
          </h2>
          <button
            type="button"
            class="close-button"
            aria-label="Close alarm editor"
            @click="dialog.close()"
            :disabled="busy"
          >
            ×
          </button>
        </div>
        <label class="field-label" for="alarm-time">Time</label>
        <input
          id="alarm-time"
          v-model="form.time"
          type="time"
          required
          class="time-input"
        />
        <fieldset class="day-fieldset">
          <legend>Repeat <small>(none = once)</small></legend>
          <div class="day-buttons">
            <button
              v-for="day in weekdays"
              :key="day.id"
              type="button"
              :aria-label="day.name"
              :aria-pressed="form.days.includes(day.id)"
              :class="{ selected: form.days.includes(day.id) }"
              @click="toggleDay(day.id)"
            >
              {{ day.short }}
            </button>
          </div>
        </fieldset>
        <label class="field-label" for="alarm-mode"
          >Challenge difficulty</label
        >
        <select id="alarm-mode" v-model="form.mode">
          <option value="easy">Easy · a little addition</option>
          <option value="medium">Medium · multiplication</option>
          <option value="hard">Hard · name that character</option>
        </select>
        <label class="field-label" for="alarm-label"
          >Label <small>(optional)</small></label
        >
        <input
          id="alarm-label"
          v-model="form.label"
          maxlength="60"
          placeholder="e.g. Weekday morning"
        />
        <label class="editor-enabled"
          ><input v-model="form.enabled" type="checkbox" /> alarm on</label
        >
        <p v-if="formError" class="message error-message" role="alert">
          {{ formError }}
        </p>
        <button type="submit" class="button pink-button" :disabled="busy">
          {{ busy ? 'saving…' : 'Save alarm' }}
        </button>
        <button
          v-if="editingId !== null"
          type="button"
          class="delete-button"
          @click="deleteAlarm"
          :disabled="busy"
        >
          delete this alarm
        </button>
      </form>
    </dialog>
  </div>
</template>
