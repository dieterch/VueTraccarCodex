import { getManualTravelWorkspaceService } from '../../services/manual-travel-workspace'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { workspaceId, title, notes } = body || {}

    if (!workspaceId || !title) {
      throw createError({
        statusCode: 400,
        statusMessage: 'workspaceId and title are required'
      })
    }

    const service = getManualTravelWorkspaceService()
    const result = service.finalizeTravel(workspaceId, title, notes)

    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Workspace not found'
      })
    }

    return { success: true, id: result.travelId }
  } catch (error: any) {
    console.error('Error finalizing manual travel:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to finalize manual travel'
    })
  }
})
