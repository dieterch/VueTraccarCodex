import { randomUUID } from 'crypto'
import { createTraccarService } from './traccar.service'
import { createManualTravel, replaceManualTravelPositions } from '../utils/app-db'

export type ManualTravelPoint = {
  id: string
  fixTime: string
  latitude: number
  longitude: number
  speed?: number
  altitude?: number
  attributes?: Record<string, any>
}

export type WorkspaceState = {
  rawPoints: ManualTravelPoint[]
  currentPoints: ManualTravelPoint[]
  selectedPointIds: string[]
}

type Workspace = WorkspaceState & {
  workspaceId: string
  deviceId: number
  fromDate: string
  toDate: string
  createdAt: number
}

class ManualTravelWorkspaceService {
  private workspaces = new Map<string, Workspace>()

  async openWorkspace(deviceId: number, fromDate: string, toDate: string): Promise<Workspace> {
    const traccarService = createTraccarService()
    const route = await traccarService.getRouteData(deviceId, fromDate, toDate)

    const points: ManualTravelPoint[] = route.map(pos => ({
      id: String(pos.id),
      fixTime: pos.fixTime,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: pos.speed,
      altitude: pos.altitude,
      attributes: pos.attributes || {}
    }))

    const workspaceId = randomUUID()
    const workspace: Workspace = {
      workspaceId,
      deviceId,
      fromDate,
      toDate,
      rawPoints: points,
      currentPoints: [...points],
      selectedPointIds: [],
      createdAt: Date.now()
    }

    this.workspaces.set(workspaceId, workspace)
    return workspace
  }

  getWorkspace(workspaceId: string): Workspace | null {
    return this.workspaces.get(workspaceId) || null
  }

  deleteSelectedPoints(workspaceId: string, pointIds: string[]): Workspace | null {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) return null

    const idSet = new Set(pointIds)
    workspace.currentPoints = workspace.currentPoints.filter(p => !idSet.has(p.id))
    workspace.selectedPointIds = []
    return workspace
  }

  keepSelectedPoints(workspaceId: string, pointIds: string[]): Workspace | null {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) return null

    const idSet = new Set(pointIds)
    workspace.currentPoints = workspace.currentPoints.filter(p => idSet.has(p.id))
    workspace.selectedPointIds = []
    return workspace
  }

  resetWorkspace(workspaceId: string): Workspace | null {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) return null

    workspace.currentPoints = [...workspace.rawPoints]
    workspace.selectedPointIds = []
    return workspace
  }

  finalizeTravel(workspaceId: string, title: string, notes?: string): { travelId: string } | null {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) return null

    const currentPoints = workspace.currentPoints
    const travelId = randomUUID()

    const fromDate = currentPoints.length > 0
      ? currentPoints[0].fixTime
      : workspace.fromDate
    const toDate = currentPoints.length > 0
      ? currentPoints[currentPoints.length - 1].fixTime
      : workspace.toDate

    createManualTravel({
      id: travelId,
      title,
      sourceDeviceId: workspace.deviceId,
      fromDate,
      toDate,
      notes
    })

    replaceManualTravelPositions(
      travelId,
      currentPoints.map(point => ({
        id: point.id || randomUUID(),
        fixTime: point.fixTime,
        latitude: point.latitude,
        longitude: point.longitude,
        speed: point.speed,
        altitude: point.altitude,
        attributes: point.attributes ? JSON.stringify(point.attributes) : null
      }))
    )

    this.workspaces.delete(workspaceId)
    return { travelId }
  }
}

let workspaceService: ManualTravelWorkspaceService | null = null

export function getManualTravelWorkspaceService(): ManualTravelWorkspaceService {
  if (!workspaceService) {
    workspaceService = new ManualTravelWorkspaceService()
  }
  return workspaceService
}
