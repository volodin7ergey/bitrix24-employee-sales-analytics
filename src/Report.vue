<template>
	<div class="app-start-box" v-if="isAppLoading">
		<v-progress-circular indeterminate />
	</div>

	<template v-else>
		<div class="filters">
			<div class="filters-box">
				<!-- Период отчета -->
				<v-date-input
					v-model="dateRange"
					label="Период отчета"
					multiple="range"
					prepend-icon="mdi-calendar-range"
					hint="Выберите диапазон дат для формирования отчета"
					persistent-hint
					clearable
					:disabled="quickPeriod !== 'custom'"
				/>

				<!-- Шаблоны периодов -->
				<v-select
					label="Шаблоны периодов"
					:items="quickOptions"
					item-title="title"
					item-value="value"
					v-model="quickPeriod"
					@update:modelValue="applyQuickPeriod"
					hint="Выберите один из шаблонов для быстрого выбора периода"
					persistent-hint
				/>
			</div>

			<v-btn
				color="primary"
				@click="loadReport"
				:disabled="isLoading"
				:loading="isLoading"
        density="default"
			>
				Сформировать отчёт
			</v-btn>
		</div>

		<div class="content">
			<div class="kpi-cards" v-if="rows.length">
				<v-row dense>
					<v-col
						cols="12"
						sm="6"
						md="3"
						v-for="card in kpiCards"
						:key="card.title"
					>
						<v-card class="kpi-card" :class="card.variant" outlined>
							<v-card-title class="kpi-card-title">
								<v-icon v-if="card.icon" class="mr-2">{{ card.icon }}</v-icon>
								{{ card.title }}
							</v-card-title>
							<v-card-text class="kpi-card-value">
								{{ card.value }}
							</v-card-text>
						</v-card>
					</v-col>
				</v-row>

			</div>
			<v-data-table
				v-if="rows.length"
				:headers="headers"
				:items="rows"
				:sort-by="[{ key: 'growth', order: 'desc' }]"
				class="elevation-1"
			>
				<!-- Имя сотрудника -->
				<template #item.name="{ item }">
					<div class="name-cell">
						<span :class="highlightClass(item)">
							{{ item.name }}
						</span>

						<v-chip
							v-if="item.growth === maxGrowth && item.growth > 0"
							color="green"
							size="x-small"
							variant="flat"
						>
							TOP
						</v-chip>
					</div>
				</template>

				<!-- Текущий период -->
				<template #item.currentPeriod="{ item }">
					<div class="period-box">
						<v-chip
							color="primary"
							size="small"
							variant="tonal"
							prepend-icon="mdi-calendar"
						>
							{{
								formatPrettyDateRange(
									new Date(item.currentPeriod.from),
									new Date(item.currentPeriod.to),
								)
							}}
						</v-chip>
					</div>
				</template>

				<!-- Предыдущий период -->
				<template #item.prevPeriod="{ item }">
					<div class="period-box">
						<v-chip
							color="primary"
							size="small"
							variant="tonal"
							prepend-icon="mdi-calendar"
						>
							{{
								formatPrettyDateRange(
									new Date(item.prevPeriod.from),
									new Date(item.prevPeriod.to),
								)
							}}
						</v-chip>
					</div>
				</template>

				<template #item.currentCount="{ item }">
					{{ item.currentCount }}
				</template>

				<template #item.prevCount="{ item }">
					{{ item.prevCount }}
				</template>

				<!-- Сумма текущего периода -->
				<template #item.currentSum="{ item }">
					<span class="money current">
						{{ formatMoney(item.currentSum) }}
					</span>
				</template>

				<template #item.prevSum="{ item }">
					<span class="money prev">
						{{ formatMoney(item.prevSum) }}
					</span>
				</template>

				<!-- Рост -->
				<template #item.growth="{ item }">
					<div class="growth-box" :style="growthStyle(item.growth)">
						<v-icon size="14" class="mr-1">
							{{ item.growth > 0 && 'mdi-arrow-up' }}
						</v-icon>
						{{ formatMoney(item.growth) }}
					</div>
				</template>
			</v-data-table>

			<!-- Если отчет еще не сформирован -->
			<div v-else-if="!reportLoaded">
				<v-alert type="info" border="left" colored-border>
					Отчет еще не сформирован. Пожалуйста, выберите нужные фильтры, затем
					нажмите <strong>«Сформировать отчет»</strong>, чтобы просмотреть
					результаты.
				</v-alert>
			</div>

			<!-- Если отчет сформирован, но данных нет -->
			<div v-else>
				<v-alert
					type="warning"
					border="left"
					colored-border
					v-if="noDataMessageRef"
				>
					{{ noDataMessageRef }}
				</v-alert>
			</div>
		</div>
	</template>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))


function groupDealsByDay(deals: any[], from: Date, to: Date) {
	const map: Record<string, number> = {}

	// создаём все дни заранее (чтобы не было дырок)
	const cursor = new Date(from)

	while (cursor <= to) {
		const key = formatDate(cursor)
		map[key] = 0
		cursor.setDate(cursor.getDate() + 1)
	}

	deals.forEach(d => {
		const key = formatDate(new Date(d.CLOSEDATE))
		if (map[key] !== undefined) {
			map[key] += Number(d.OPPORTUNITY || 0)
		}
	})

	return Object.values(map)
}

// Дата и быстрый фильтр
const dateRange = ref<any[]>([])
const quickPeriod = ref('current_year')

function onDateRangeChange() {
	quickPeriod.value = 'custom' // если пользователь выбрал вручную, устанавливаем "свой период"
}

// Быстрые шаблоны с добавлением "Свой период"
const quickOptions = [
	{ title: 'Текущая неделя', value: 'current_week' },
	{ title: 'Предыдущая неделя', value: 'previous_week' },
	{ title: 'Текущий месяц', value: 'current_month' },
	{ title: 'Предыдущий месяц', value: 'previous_month' },
	{ title: '1 квартал', value: 'q1' },
	{ title: '2 квартал', value: 'q2' },
	{ title: '3 квартал', value: 'q3' },
	{ title: '4 квартал', value: 'q4' },
	{ title: 'Текущий год', value: 'current_year' },
	{ title: 'Свой период', value: 'custom' },
]

const headers = [
	{ title: 'Сотрудник', key: 'name' },
	{ title: 'Период (текущий)', key: 'currentPeriod' },
	{ title: 'Сделки', key: 'currentCount' },
	{ title: 'Сумма', key: 'currentSum' },
	{ title: 'Период (пред.)', key: 'prevPeriod' },
	{ title: 'Сделки', key: 'prevCount' },
	{ title: 'Сумма', key: 'prevSum' },
	{ title: 'Δ Рост', key: 'growth' },
]

function highlightClass(item: any) {
	return {
		'highlight-leader': item.growth === maxGrowth.value && item.growth > 0,
	}
}

// --- Функция для корректного форматирования локальной даты ---
function formatDate(date: Date) {
	if (!date) return '—'

	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}
// --- Проверка валидности выбранного диапазона ---
function isDateRangeValid(): boolean {
	return (
		Array.isArray(dateRange.value) &&
		dateRange.value.length === 2 &&
		dateRange.value[0] instanceof Date &&
		!isNaN(dateRange.value[0].getTime()) &&
		dateRange.value[1] instanceof Date &&
		!isNaN(dateRange.value[1].getTime())
	)
}

function validateDateRange(from?: Date, to?: Date): string | null {
	const now = new Date()

	if (!from && !to) return 'Выберите период отчета'
	if (!from || !to) return 'Пожалуйста, выберите обе даты периода'

	if (from > to) return 'Начальная дата не может быть позже конечной'

	if (from.getTime() > now.getTime() || to.getTime() > now.getTime()) {
		return `Вы выбрали будущий период ${from.getFullYear()}–${to.getFullYear()}. Данных пока нет`
	}

	return null
}

watch(dateRange, val => {
	// Если даты не выбраны или неполный диапазон
	if (!val || val.length < 2 || !val[0] || !val[1]) {
		// Не удаляем полностью данные
		reportLoaded.value = false

		// Показать информативное сообщение вместо таблицы
		noDataMessageRef.value =
			'Пожалуйста, выберите период для формирования отчета'
		return
	}

	// Если даты корректные — убираем сообщение
	noDataMessageRef.value = ''
})

function growthStyle(value: number) {
	if (value === maxGrowth.value) {
		return {
			background: 'linear-gradient(90deg, #e8f5e9, #a5d6a7)',
			color: '#1b5e20',
			padding: '0.3rem 0.5rem',
			borderRadius: '4px',
			fontWeight: '600',
			display: 'inline-block',
			minWidth: '60px',
			textAlign: 'right',
		}
	} else if (value > 0) {
		const intensity = Math.min(
			200,
			50 + Math.round((value / maxGrowth.value) * 150),
		)
		return { color: `rgb(0, ${intensity}, 0)`, fontWeight: '500' }
	} else {
		return { color: 'red', fontWeight: '500' }
	}
}

const isAppLoading = ref(true)
const isLoading = ref(false)
const rows = ref([])
const reportLoaded = ref(false)
const noDataMessageRef = ref('')
const maxGrowth = computed(() => {
	if (!rows.value.length) return 0

	const positives = rows.value.map(r => r.growth).filter(g => g > 0)

	return positives.length ? Math.max(...positives) : 0
})

function isFuturePeriod(from: string | Date, to?: string | Date) {
	const now = new Date()
	const fromDate = new Date(from)
	const toDate = new Date(to)
	return fromDate.getTime() > now.getTime() || toDate.getTime() > now.getTime()
}



function formatPrettyDateRange(from?: Date | null, to?: Date | null) {
	if (!from || !to) return '—'

	const months = [
		'янв',
		'фев',
		'мар',
		'апр',
		'май',
		'июн',
		'июл',
		'авг',
		'сен',
		'окт',
		'ноя',
		'дек',
	]

	const fDay = from.getDate()
	const fMonth = from.getMonth()
	const fYear = from.getFullYear()

	const tDay = to.getDate()
	const tMonth = to.getMonth()
	const tYear = to.getFullYear()

	// Один месяц и год
	if (fMonth === tMonth && fYear === tYear) {
		return `${fDay}–${tDay} ${months[fMonth]} ${fYear}`
	}

	// Один год, но разные месяцы
	if (fYear === tYear) {
		return `${fDay} ${months[fMonth]} – ${tDay} ${months[tMonth]} ${fYear}`
	}

	// Разные годы (редко, но на всякий)
	return `${fDay} ${months[fMonth]} ${fYear} – ${tDay} ${months[tMonth]} ${tYear}`
}

// Установка диапазона по быстрому шаблону
function applyQuickPeriod() {
	if (!quickPeriod.value || quickPeriod.value === 'custom') return

	const now = new Date()
	let from: Date, to: Date

	switch (quickPeriod.value) {
		case 'current_week': {
			const day = now.getDay() || 7
			from = new Date(now)
			from.setDate(now.getDate() - day + 1)
			to = new Date(from)
			to.setDate(from.getDate() + 6)
			break
		}
		case 'previous_week': {
			const prev = new Date(now)
			prev.setDate(now.getDate() - 7)
			const day = prev.getDay() || 7
			from = new Date(prev)
			from.setDate(prev.getDate() - day + 1)
			to = new Date(from)
			to.setDate(from.getDate() + 6)
			break
		}
		case 'current_month':
			from = new Date(now.getFullYear(), now.getMonth(), 1)
			to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
			break
		case 'previous_month':
			from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
			to = new Date(now.getFullYear(), now.getMonth(), 0)
			break
		case 'q1':
			from = new Date(now.getFullYear(), 0, 1)
			to = new Date(now.getFullYear(), 2, 31)
			break
		case 'q2':
			from = new Date(now.getFullYear(), 3, 1)
			to = new Date(now.getFullYear(), 5, 30)
			break
		case 'q3':
			from = new Date(now.getFullYear(), 6, 1)
			to = new Date(now.getFullYear(), 8, 30)
			break
		case 'q4':
			from = new Date(now.getFullYear(), 9, 1)
			to = new Date(now.getFullYear(), 11, 31)
			break
		case 'current_year':
			from = new Date(now.getFullYear(), 0, 1)
			to = new Date(now.getFullYear(), 11, 31)
			break
	}

	dateRange.value = [from, to]
}

function parseLocalDate(date?: Date) {
	if (!date) return null

	return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatMoney(val: number) {
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(val)
}
function fetchAll(method: string, params: any) {
	return new Promise(resolve => {
		const result: any[] = []

		function request(start = 0) {
			BX24.callMethod(method, { ...params, start }, (res: any) => {
				result.push(...res.data())
				if (res.more()) {
					request(res.next())
				} else {
					resolve(result)
				}
			})
		}

		request()
	})
}

function normalizeDate(date: Date) {
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
}

const totalDeals = computed(() =>
	rows.value.reduce((sum, r) => sum + r.currentCount, 0),
)
const totalSum = computed(() =>
	rows.value.reduce((sum, r) => sum + r.currentSum, 0),
)
const totalGrowth = computed(() =>
	rows.value.reduce((sum, r) => sum + r.growth, 0),
)
const topEmployee = computed(() => {
	if (!rows.value.length) return null
	const positiveRows = rows.value.filter(r => r.growth > 0)
	if (!positiveRows.length) return null
	return positiveRows.reduce((prev, curr) =>
		curr.growth > prev.growth ? curr : prev,
	)
})

const kpiCards = computed(() => [
	{
		title: 'Всего сделок',
		value: totalDeals.value,
		icon: 'mdi-handshake',
		variant: 'blue',
	},
	{
		title: 'Сумма продаж',
		value: formatMoney(totalSum.value),
		icon: 'mdi-cash',
		variant: 'purple',
	},
	{
		title: 'Рост за период',
		value: formatMoney(totalGrowth.value),
		icon: totalGrowth.value >= 0 ? 'mdi-trending-up' : 'mdi-trending-down',
		variant: totalGrowth.value >= 0 ? 'green' : 'red',
	},
	{
		title: 'Лидер по росту',
		value: topEmployee.value?.name || '—',
		icon: 'mdi-star',
		variant: 'gold',
	},
])

const sparklineData = ref<number[]>([])
const sparklineCount = ref<number[]>([])


// --- Загрузка отчета с корректными датами ---
async function loadReport() {
	if (!isDateRangeValid()) {
		toast.warning(
			'Пожалуйста, выберите корректный период для формирования отчета. Убедитесь, что обе даты указаны, начальная дата не позже конечной и период не находится в будущем.',
		)
		return
	}

	reportLoaded.value = false
	isLoading.value = true

	// Берем локальные даты из dateRange
	const currentFrom = parseLocalDate(dateRange.value[0])!
	const currentTo = parseLocalDate(dateRange.value[1])!

	if (isFuturePeriod(currentFrom)) {
		toast.info('Вы выбрали будущий период. Данные по нему будут доступны позже')

		isLoading.value = false
		return
	}

	// Разница в днях (для вычисления предыдущего периода)
	const diff =
		Math.round((currentTo.getTime() - currentFrom.getTime()) / 86400000) + 1

	// Предыдущий период
	const prevFrom = new Date(currentFrom)
	prevFrom.setDate(prevFrom.getDate() - diff)
	const prevTo = new Date(currentFrom)
	prevTo.setDate(prevTo.getDate() - 1)

	// Получаем список пользователей
	const usersList: any = await fetchAll('user.get', {
		FILTER: { UF_DEPARTMENT: ['4'] },
	})

	// Получаем сделки текущего и предыдущего периода
	const currentDeals: any = await fetchAll('crm.deal.list', {
		select: ['ASSIGNED_BY_ID', 'OPPORTUNITY', 'CLOSEDATE'],
		filter: {
			'>=CLOSEDATE': formatDate(currentFrom),
			'<=CLOSEDATE': formatDate(currentTo),
			STAGE_SEMANTIC_ID: 'S',
		},
	})

	const prevDeals: any = await fetchAll('crm.deal.list', {
		select: ['ASSIGNED_BY_ID', 'OPPORTUNITY', 'CLOSEDATE'],
		filter: {
			'>=CLOSEDATE': formatDate(prevFrom),
			'<=CLOSEDATE': formatDate(prevTo),
			STAGE_SEMANTIC_ID: 'S',
		},
	})
const dealsByDay = groupDealsByDay(currentDeals, currentFrom, currentTo)

function groupCountByDay(deals: any[], from: Date, to: Date) {
	const map: Record<string, number> = {}

	const cursor = new Date(from)

	while (cursor <= to) {
		map[formatDate(cursor)] = 0
		cursor.setDate(cursor.getDate() + 1)
	}

	deals.forEach(d => {
		const key = formatDate(new Date(d.CLOSEDATE))
		if (map[key] !== undefined) {
			map[key] += 1
		}
	})

	return Object.values(map)
}

const dealsCountByDay = groupCountByDay(currentDeals, currentFrom, currentTo)

sparklineData.value = dealsByDay
sparklineCount.value = dealsCountByDay
	// Сообщение об отсутствии данных
	let noDataMessage = ''
	if (!usersList.length) {
		noDataMessage = 'В отделе продаж нет сотрудников'
	} else if (!currentDeals.length && !prevDeals.length) {
		noDataMessage =
			'По выбранному периоду у сотрудников нет завершенных сделок.'
	}

	// Формируем строки для таблицы
	rows.value = usersList
		.map((u: any) => {
			const name =
				[u.NAME, u.LAST_NAME].filter(Boolean).join(' ') || 'Без имени'

			const cur = currentDeals.filter(
				(d: any) =>
					d.ASSIGNED_BY_ID === u.ID &&
					new Date(d.CLOSEDATE).getTime() >= currentFrom.getTime() &&
					new Date(d.CLOSEDATE).getTime() <= currentTo.getTime(),
			)

			const prev = prevDeals.filter(
				(d: any) =>
					d.ASSIGNED_BY_ID === u.ID &&
					new Date(d.CLOSEDATE).getTime() >= prevFrom.getTime() &&
					new Date(d.CLOSEDATE).getTime() <= prevTo.getTime(),
			)

			const currentSum = cur.reduce(
				(s: number, d: any) => s + Number(d.OPPORTUNITY),
				0,
			)
			const prevSum = prev.reduce(
				(s: number, d: any) => s + Number(d.OPPORTUNITY),
				0,
			)

			return {
				userId: u.ID,
				name,
				currentPeriod: {
					from: formatDate(currentFrom),
					to: formatDate(currentTo),
				},
				prevPeriod: { from: formatDate(prevFrom), to: formatDate(prevTo) },
				currentCount: cur.length,
				currentSum,
				prevCount: prev.length,
				prevSum,
				growth: currentSum - prevSum,
			}
		})
		.sort((a: any, b: any) => b.growth - a.growth)

	isLoading.value = false
	reportLoaded.value = true
	noDataMessageRef.value = noDataMessage
}

onMounted(async () => {
	await sleep(1000)

	applyQuickPeriod()
	isAppLoading.value = false
})
</script>

<style scoped>
.app-start-box {
	width: 100%;
	height: 100dvh;
	display: grid;
	place-items: center;
}

.v-data-table td {
	vertical-align: middle;
}

.filters {
	margin-bottom: 1rem;
}

.filters-box {
	display: flex;
	gap: 1rem;
	margin-bottom: 1rem;
}

.highlight {
	color: green;
	font-weight: bold;
}

/* Тренд-иконка для лидера */
.trend-icon {
	font-size: 0.8em;
	color: #4caf50;
	margin-left: 0.2rem;
}

/* Фон для лидера по имени */
.highlight-leader {
	background: linear-gradient(90deg, #e8f5e9, #a5d6a7);
	color: #1b5e20;
	padding: 0.2rem 0.5rem;
	border-radius: 4px;
	font-weight: 600;
}

.name-cell {
	display: flex;
	align-items: center;
	gap: 6px;
}
.sparkline {
	display: inline-block;
	vertical-align: middle;
}

.money {
	font-weight: 600;
	font-variant-numeric: tabular-nums;
}

.money.current {
	color: #1e88e5;
}

.money.prev {
	color: #90a4ae;
}

.money,
.growth-box {
	text-align: right;
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.kpi-cards {
  margin-bottom: 1rem;
}

.kpi-card {
	border-radius: 12px;
	padding: 1rem;
	transition:
		transform 0.2s ease,
		box-shadow 0.2s ease;
	cursor: default;
}

.kpi-card:hover {
	transform: translateY(-4px);
	box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.kpi-card-title {
	font-weight: 600;
	display: flex;
	align-items: center;
	font-size: 0.95rem;
}

.kpi-card-value {
	font-size: 1rem;
	font-weight: 700;
	margin-top: 0.5rem;
	text-align: right;
}

/* Цветовые градиенты */
.kpi-card.blue {
	background: linear-gradient(135deg, #90caf9, #42a5f5);
	color: #fff;
}
.kpi-card.purple {
	background: linear-gradient(135deg, #ce93d8, #ab47bc);
	color: #fff;
}
.kpi-card.green {
	background: linear-gradient(135deg, #a5d6a7, #4caf50);
	color: #1b5e20;
}
.kpi-card.red {
	background: linear-gradient(135deg, #ef9a9a, #e53935);
	color: #fff;
}
.kpi-card.gold {
	background: linear-gradient(135deg, #ffe082, #ffc107);
	color: #6d4c41;
}
</style>
