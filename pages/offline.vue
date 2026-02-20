<template>
  <div class="offline-page">
    <h1>Offline</h1>
    <p>Der Server ist gerade nicht erreichbar.</p>
    <p>Wenn eine Reise bereits geladen wurde, kann sie aus dem Cache angezeigt werden.</p>
    <NuxtLink to="/">Zur Startseite</NuxtLink>
  </div>
</template>

<style scoped>
.offline-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 24px;
}
</style>
