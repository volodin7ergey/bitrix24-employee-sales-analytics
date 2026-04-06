

interface Task {
  id: number
  title: string
  responsibleId: number
  timeEstimate: number
  timeSpentInLogs: number
  startDatePlan?: string
  createdDate?: string
  closedDate?: string
  status?: string
  deadline?: string
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0м'
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  const parts: string[] = []
  if (h) parts.push(`${h}ч`)
  if (m) parts.push(`${m}м`)
  if (!h && s) parts.push(`${s}с`)
  return parts.join(' ')
}

// export function getTaskDurationDays(task: Task) {
//   const start = task.startDatePlan || task.createdDate
//   const end = task.closedDate || new Date().toISOString()
//   if (!start) return 0
//   return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000*60*60*24))
// }

export function getTaskDurationDays(task: Task): number {
	const startRaw = task.startDatePlan || task.createdDate
	if (!startRaw) return 0

	const start = new Date(startRaw)
	const end = task.closedDate
		? new Date(task.closedDate)
		: new Date()

	const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())
	const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())

	const diffMs = endDate.getTime() - startDate.getTime()

	return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}