import { BillingPlan, formatCurrency } from '@/lib/payment-client'

export type PricingPlanMeta = {
  badge: string | null
  highlight: boolean
  summary: string
}

export function sortPricingPlans(plans: BillingPlan[]) {
  return [...plans].sort((left, right) => {
    if ((left.course.displayOrder || 0) !== (right.course.displayOrder || 0)) {
      return (left.course.displayOrder || 0) - (right.course.displayOrder || 0)
    }

    if (left.durationMonths !== right.durationMonths) {
      return left.durationMonths - right.durationMonths
    }

    return left.amountPaise - right.amountPaise
  })
}

export function getPricingPlanMeta(plan: BillingPlan, plans: BillingPlan[]): PricingPlanMeta {
  const sortedPlans = sortPricingPlans(plans)
  const longestPlan = sortedPlans[sortedPlans.length - 1]
  const recommendedPlan =
    sortedPlans.find((candidate) => candidate.durationMonths === 12) ||
    sortedPlans[Math.min(1, sortedPlans.length - 1)] ||
    sortedPlans[0]

  if (longestPlan?.planId === plan.planId && sortedPlans.length > 2) {
    return {
      badge: 'Best Deal',
      highlight: recommendedPlan?.planId !== plan.planId,
      summary: 'Best value for extended preparation',
    }
  }

  if (recommendedPlan?.planId === plan.planId) {
    return {
      badge: 'Most Popular',
      highlight: true,
      summary: 'Recommended for consistent study routines',
    }
  }

  if (plan.durationMonths <= 6) {
    return {
      badge: null,
      highlight: false,
      summary: 'Structured access for focused preparation',
    }
  }

  return {
    badge: null,
    highlight: false,
    summary: 'Flexible access for your prep window',
  }
}

export function PricingPlanCard({
  meta,
  onSelect,
  plan,
  tilt,
}: {
  meta: PricingPlanMeta
  plan: BillingPlan
  tilt: 'left' | 'right'
  onSelect: (plan: BillingPlan) => void
}) {
  const durationLabel = formatDuration(plan.durationMonths)
  const features = getPlanFeatures(plan)

  return (
    <div
      className={cn(
        'group relative flex min-h-full w-full flex-col rounded-[30px] border bg-white p-6 shadow-[0_22px_54px_rgba(109,40,217,0.08)] transition-all duration-300 ease-out will-change-transform hover:-translate-y-2 hover:scale-[1.015] hover:shadow-[0_34px_80px_rgba(109,40,217,0.18)] motion-reduce:transform-none motion-reduce:transition-none',
        tilt === 'left' ? 'hover:-rotate-1' : 'hover:rotate-1',
        meta.highlight
          ? 'border-[#7c3aed] bg-[#f7f2ff] shadow-[0_28px_70px_rgba(109,40,217,0.16)]'
          : 'border-[#ebe2ff]'
      )}
    >
      {meta.badge && (
        <span className="absolute right-5 top-0 -translate-y-1/2 rounded-xl bg-[#7c3aed] px-4 py-2 text-xs font-bold uppercase tracking-normal text-white shadow-[0_14px_28px_rgba(109,40,217,0.22)]">
          {meta.badge}
        </span>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-2xl font-bold tracking-normal text-slate-950">{formatPlanName(plan)}</h3>
          <p className="mt-2 text-sm font-medium text-[#5a5d78]">Valid for {durationLabel}</p>
        </div>

        <SelectionCheck active={meta.highlight} />
      </div>

      <div className="mt-6">
        <span className="text-5xl font-bold tracking-normal text-slate-950">
          {formatCurrency(plan.amountPaise, plan.currency)}
        </span>
        <span className="ml-2 text-base font-semibold text-[#6b7280]">/ {durationLabel}</span>
      </div>

      <div className="mt-4 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-center text-sm font-bold text-[#8a4a0f]">
        {meta.summary}
      </div>

      <div className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#14b8a6] text-[#0f9f91]">
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-medium leading-6 text-slate-700">{feature}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSelect(plan)}
        className={cn(
          'mt-7 inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-base font-semibold transition',
          meta.highlight
            ? 'bg-[#6d28d9] text-white shadow-[0_18px_38px_rgba(109,40,217,0.24)] hover:bg-[#5b21b6]'
            : 'border border-[#d8ccff] bg-white text-slate-950 hover:border-[#7c3aed] hover:text-[#6d28d9]'
        )}
      >
        Start with {durationLabel}
      </button>
    </div>
  )
}

function formatPlanName(plan: BillingPlan) {
  if (plan.name?.trim()) {
    return plan.name.trim()
  }

  return `${formatDuration(plan.durationMonths)} Plan`
}

function formatDuration(durationMonths: number) {
  if (durationMonths === 1) {
    return '1 month'
  }

  if (durationMonths % 12 === 0) {
    const years = durationMonths / 12
    return `${years} ${years === 1 ? 'year' : 'years'}`
  }

  return `${durationMonths} months`
}

function getPlanFeatures(plan: BillingPlan) {
  const coreFeatures = [
    'Daily study rooms with built-in focus tools',
    'Revision notes powered by spaced repetition',
    'Live rankings for consistent accountability',
    'Communities access for peer learning and support',
  ]

  if (plan.durationMonths >= 24) {
    return [...coreFeatures, 'Priority long-term preparation access']
  }

  if (plan.durationMonths >= 12) {
    return [...coreFeatures, 'Best fit for full-cycle preparation']
  }

  return [...coreFeatures, 'Flexible access for focused preparation']
}

function SelectionCheck({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
        active ? 'border-[#7c3aed] bg-[#7c3aed] text-white' : 'border-[#d8ccff] bg-white text-[#7c3aed]'
      )}
    >
      <CheckIcon className="h-4 w-4" />
    </span>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}
