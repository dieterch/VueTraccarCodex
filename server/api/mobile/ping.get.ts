export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  return {
    success: true,
    user: auth?.user || null,
    role: auth?.role || null
  }
})
