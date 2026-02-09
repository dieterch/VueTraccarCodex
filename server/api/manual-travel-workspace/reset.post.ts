import { getManualTravelWorkspaceService } from '../../services/manual-travel-workspace'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || auth.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  try {
    const body = await readBody(event)
    const { workspaceId } = body || {}

    if (!workspaceId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'workspaceId is required'
      })
    }

    const service = getManualTravelWorkspaceService()
    const workspace = service.resetWorkspace(workspaceId)

    if (!workspace) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Workspace not found'
      })
    }

    return { success: true, points: workspace.currentPoints }
  } catch (error: any) {
    console.error('Error resetting manual travel workspace:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to reset manual travel workspace'
    })
  }
})
