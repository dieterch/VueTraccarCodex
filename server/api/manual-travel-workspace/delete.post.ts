import { getManualTravelWorkspaceService } from '../../services/manual-travel-workspace'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { workspaceId, pointIds } = body || {}

    if (!workspaceId || !Array.isArray(pointIds)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'workspaceId and pointIds are required'
      })
    }

    const service = getManualTravelWorkspaceService()
    const workspace = service.deleteSelectedPoints(workspaceId, pointIds)

    if (!workspace) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Workspace not found'
      })
    }

    return { success: true, points: workspace.currentPoints }
  } catch (error: any) {
    console.error('Error deleting manual travel points:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to delete manual travel points'
    })
  }
})
