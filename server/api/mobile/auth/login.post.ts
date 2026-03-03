export default defineEventHandler(async (event) => {
  console.info('[auth] mobile login endpoint reached')
  setResponseStatus(event, 501)
  return {
    error: 'not_implemented',
    message: 'Mobile login is not implemented yet.'
  }
})
