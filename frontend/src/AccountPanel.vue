<script setup>
import { ref, computed } from 'vue'
import { api } from './api'
import { readLocal, writeLocal, profileKey, validProfile } from './local-settings'

const props = defineProps({ user: { type: Object, required: true } })
const emit = defineEmits(['close'])
const tab = ref('profile')
const profile = ref(
  readLocal(profileKey(props.user.id), {
    firstName: '',
    lastName: '',
    username: '',
  }),
)
const message = ref('')
const failed = ref(false)
const confirmation = ref(null)
const search = ref('')
const adminUsers = ref([])
const adminLoading = ref(false)
const uploading = ref(false)
const images = ref(
  readLocal('brainring-demo-images', [
    {
      id: 'sample',
      name: 'Tung Tung Tung Sahur',
      answer: 'Tung Tung Tung Sahur',
      src: '/images/sahur.png',
    },
  ]),
)
const imageName = ref('')
const imageAnswer = ref('')
const imageFile = ref(null)
const fileInput = ref(null)

const matches = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return adminUsers.value
  return adminUsers.value.filter((user) =>
    user.email.toLowerCase().includes(query),
  )
})

function report(text, error = false) {
  message.value = text
  failed.value = error
}

function saveProfile() {
  if (!validProfile(profile.value))
    return report(
      'Enter first and last names (up to 50 characters) and a username with 5-25 letters or digits.',
      true,
    )
  const clean = {
    firstName: profile.value.firstName.trim(),
    lastName: profile.value.lastName.trim(),
    username: profile.value.username.trim(),
  }
  if (!writeLocal(profileKey(props.user.id), clean))
    return report('Could not save. Browser storage is unavailable or full.', true)
  profile.value = clean
  report('Profile details saved in this browser.')
}

async function loadAdminUsers() {
  if (!props.user.isAdmin) return
  adminLoading.value = true
  try {
    adminUsers.value = await api('/admin/users')
  } catch (error) {
    report(error.message, true)
  } finally {
    adminLoading.value = false
  }
}

async function openAdmin() {
  if (!props.user.isAdmin) return
  tab.value = 'admin'
  message.value = ''
  confirmation.value = null
  await loadAdminUsers()
}

async function addImage() {
  if (uploading.value) return
  const file = imageFile.value
  if (
    !file ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  )
    return report('Choose a PNG, JPEG or WebP image up to 2 MB.', true)
  if (!imageName.value.trim() || !imageAnswer.value.trim())
    return report('Enter an image name and the correct answer.', true)
  uploading.value = true
  try {
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = resolve
      image.onerror = reject
      image.src = src
    })
    const next = [
      ...images.value,
      {
        id: crypto.randomUUID(),
        name: imageName.value.trim(),
        answer: imageAnswer.value.trim(),
        src,
      },
    ]
    if (!writeLocal('brainring-demo-images', next))
      return report('Image could not be saved. Browser storage may be full.', true)
    images.value = next
    imageName.value = ''
    imageAnswer.value = ''
    imageFile.value = null
    fileInput.value.value = ''
    report('Image added to the demonstration gallery. Alarm questions are unchanged.')
  } catch {
    report('The image could not be read. Choose a valid image file.', true)
  } finally {
    uploading.value = false
  }
}

async function confirmAction() {
  const item = confirmation.value
  if (!item) return
  if (item.kind === 'image') {
    const next = images.value.filter((image) => image.id !== item.id)
    if (!writeLocal('brainring-demo-images', next)) {
      confirmation.value = null
      return report('Could not save the deletion.', true)
    }
    images.value = next
    report('Image removed from the demonstration gallery.')
  } else if (item.kind === 'user') {
    if (!props.user.isAdmin)
      return report('Administrator access is required.', true)
    try {
      await api(`/admin/users/${item.id}`, { method: 'DELETE' })
      adminUsers.value = adminUsers.value.filter((user) => user.id !== item.id)
      report('User deleted successfully.')
    } catch (error) {
      report(error.message, true)
    }
  } else {
    report(
      'Account deletion is not connected yet. Your account and alarms have not been deleted.',
      true,
    )
  }
  confirmation.value = null
}
</script>
<template>
  <section class="account-panel paper-card" aria-labelledby="account-title">
    <div class="dialog-heading"><h1 id="account-title">Account & settings</h1><button class="text-button" @click="emit('close')">Back to alarms</button></div>
    <nav class="settings-tabs" aria-label="Account sections">
      <button :aria-pressed="tab === 'profile'" @click="tab = 'profile'; message = ''; confirmation = null">Profile</button>
      <button v-if="user.isAdmin" :aria-pressed="tab === 'admin'" @click="openAdmin">Admin</button>
    </nav>
    <p v-if="message" class="message" :class="{ 'error-message': failed }" :role="failed ? 'alert' : 'status'">{{ message }}</p>
    <template v-if="tab === 'profile'">
      <p class="settings-note">Additional profile details are stored only in this browser. Email and password changes require server support. Username uniqueness will be checked when server support is added.</p>
      <form @submit.prevent="saveProfile" class="settings-form">
        <label>First name<input v-model="profile.firstName" required maxlength="50" autocomplete="given-name" /></label>
        <label>Last name<input v-model="profile.lastName" required maxlength="50" autocomplete="family-name" /></label>
        <label>Username<input v-model="profile.username" required minlength="5" maxlength="25" pattern="[a-zA-Z0-9]{5,25}" autocomplete="username" /></label>
        <label>Email<input :value="user.email" type="email" readonly /></label>
        <button class="button pink-button">Save profile</button>
      </form>
      <section class="danger-zone"><h2>Delete account</h2><p class="settings-note">Server integration is pending. Account deletion is currently unavailable.</p><button class="button secondary-button" @click="confirmation = { kind: 'account' }">Review account deletion</button></section>
    </template>
    <template v-else-if="user.isAdmin">
        <p class="settings-note">Connected to backend admin API. You can search and delete regular users.</p>
      <h2>Users</h2><label class="settings-search">Search demo users<input v-model="search" type="search" placeholder="Name, username or email" /></label>
        <ul v-if="!adminLoading" class="management-list"><li v-for="person in matches" :key="person.id"><div><strong>{{ person.email }}</strong><small>{{ person.isAdmin ? 'Administrator' : 'User' }}</small></div><button class="text-button" :disabled="person.isAdmin || person.id === user.id" @click="confirmation = { kind: 'user', id: person.id, name: person.email }">Delete user</button></li></ul>
        <p v-else class="settings-note" role="status">Loading users…</p>
        <p v-if="!adminLoading && !matches.length" class="settings-note" role="status">No users found.</p>
      <h2>Brainrot images</h2>
      <p class="settings-note">Image upload is still local-only and does not publish to backend questions yet.</p>
      <form class="settings-form" @submit.prevent="addImage">
        <label>Image name<input v-model="imageName" required maxlength="100" /></label>
        <label>Correct answer<input v-model="imageAnswer" required maxlength="100" /></label>
        <label>Image file (PNG, JPEG, WebP; max 2 MB)<input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" required @change="imageFile = $event.target.files[0]" /></label>
        <button class="button pink-button" :disabled="uploading">{{ uploading ? 'Reading image...' : 'Add demo image' }}</button>
      </form>
      <div class="image-gallery"><article v-for="image in images" :key="image.id"><img :src="image.src" :alt="image.name" /><strong>{{ image.name }}</strong><small>Answer: {{ image.answer }}</small><button class="text-button" @click="confirmation = { kind: 'image', id: image.id, name: image.name }">Delete image</button></article></div>
      <p v-if="!images.length" class="settings-note">No images in the demonstration gallery.</p>
    </template>
    <section v-if="confirmation" class="confirmation-box" role="region" aria-labelledby="confirm-title">
      <h2 id="confirm-title">{{ confirmation.kind === 'account' ? 'Account deletion unavailable' : 'Confirm deletion' }}</h2>
      <p>{{ confirmation.kind === 'account' ? 'This action needs a server endpoint that securely deletes your account and related data. No data will be deleted.' : 'Remove ' + confirmation.name + ' from this demonstration?' }}</p>
      <div class="confirmation-actions"><button class="button secondary-button" @click="confirmation = null">Cancel</button><button v-if="confirmation.kind !== 'account'" class="button pink-button" @click="confirmAction">Confirm deletion</button></div>
    </section>
  </section>
</template>
