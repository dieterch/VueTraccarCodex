import { getManualTravelWorkspaceService } from '../../services/manual-travel-workspace'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || auth.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  try {
    const body = await readBody(event)
    const { deviceId, fromDate, toDate } = body || {}

    if (!deviceId || !fromDate || !toDate) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: deviceId, fromDate, toDate'
      })
    }

    const service = getManualTravelWorkspaceService()
    const workspace = await service.openWorkspace(Number(deviceId), fromDate, toDate)

    return {
      success: true,
      workspaceId: workspace.workspaceId,
      points: workspace.currentPoints
    }
  } catch (error: any) {
    console.error('Error opening manual travel workspace:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to open manual travel workspace'
    })
  }
})
