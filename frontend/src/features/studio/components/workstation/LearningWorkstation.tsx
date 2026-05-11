import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { ActSection } from "@/features/studio/components/workstation/ActSection"
import { DynamicContextIsland } from "@/features/studio/components/workstation/DynamicContextIsland"
import { MicroStrip } from "@/features/studio/components/workstation/MicroStrip"
import { useLearningWorkstationState } from "@/features/studio/components/workstation/useLearningWorkstationState"
import {
  getTransitionIntent,
  type TransitionIntent,
} from "@/features/studio/components/workstation/workstationMotion"
import type {
  ActVisibility,
  LearningWorkstationState,
  RuntimeShellState,
} from "@/features/studio/components/workstation/workstationTypes"
import { cn } from "@/lib/utils"

type ActKey = "act1" | "act2" | "act3" | "act4" | "act5"

type WorkstationAct = {
  title: string
  summary: string
  eyebrow?: string
  content: ReactNode
}

type WorkstationHeroInput =
  | ReactNode
  | ((state: LearningWorkstationState) => ReactNode)

type WorkstationActsInput =
  | Record<ActKey, WorkstationAct>
  | ((state: LearningWorkstationState) => Record<ActKey, WorkstationAct>)

type LearningWorkstationProps = {
  systemState: LearningWorkstationState
  runtimeState?: RuntimeShellState
  subjectName: string
  storageScope?: string
  stageTitle: string
  stageMeta: string
  hero: WorkstationHeroInput
  acts: WorkstationActsInput
  transitionIntentOverride?: TransitionIntent | null
}

const TRANSITION_INTENT_RESET_MS = 820

const ACT_VISIBILITY: Record<
  LearningWorkstationState,
  Record<ActKey, ActVisibility>
> = {
  progress: {
    act1: "expanded",
    act2: "expanded",
    act3: "compressed",
    act4: "compressed",
    act5: "compressed",
  },
  practice: {
    act1: "expanded",
    act2: "hidden",
    act3: "hidden",
    act4: "hidden",
    act5: "hidden",
  },
  review: {
    act1: "compressed",
    act2: "compressed",
    act3: "expanded",
    act4: "expanded",
    act5: "expanded",
  },
}

function renderAct(act: WorkstationAct, visibility: ActVisibility) {
  if (visibility === "hidden") {
    return (
      <section
        hidden
        aria-hidden="true"
        data-testid={`workstation-hidden-${act.title}`}
      />
    )
  }

  if (visibility === "compressed") {
    return (
      <MicroStrip title={act.title} summary={act.summary}>
        {act.content}
      </MicroStrip>
    )
  }

  return (
    <ActSection title={act.title} eyebrow={act.eyebrow} visibility={visibility}>
      {act.content}
    </ActSection>
  )
}

export function LearningWorkstation({
  systemState,
  runtimeState = "ready",
  subjectName,
  storageScope,
  stageTitle,
  stageMeta,
  hero,
  acts,
  transitionIntentOverride = null,
}: LearningWorkstationProps) {
  const {
    previewState,
    overrideState,
    renderState,
    setPreviewState,
    setOverrideState,
    clearManualState,
  } = useLearningWorkstationState(systemState, storageScope)
  const [transitionIntent, setTransitionIntent] =
    useState<TransitionIntent>("none")
  const previousRenderStateRef = useRef<LearningWorkstationState | null>(null)
  const practiceHeroRef = useRef<HTMLDivElement | null>(null)
  const reviewHeroRef = useRef<HTMLDivElement | null>(null)
  const visibility: Record<ActKey, ActVisibility> =
    runtimeState === "preflight" ||
    runtimeState === "loading" ||
    runtimeState === "error"
      ? {
          act1: "expanded",
          act2: "hidden",
          act3: "hidden",
          act4: "hidden",
          act5: "hidden",
        }
      : runtimeState === "degraded"
        ? {
            act1: "expanded",
            act2: "compressed",
            act3: "expanded",
            act4: "hidden",
            act5: "hidden",
          }
        : ACT_VISIBILITY[renderState]

  useEffect(() => {
    const previousState = previousRenderStateRef.current
    setTransitionIntent(getTransitionIntent(previousState, renderState))
    previousRenderStateRef.current = renderState
  }, [renderState])

  useEffect(() => {
    if (transitionIntent === "none") {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setTransitionIntent("none")
    }, TRANSITION_INTENT_RESET_MS)

    return () => window.clearTimeout(timeoutId)
  }, [transitionIntent])

  useEffect(() => {
    if (renderState === "practice") {
      if (
        practiceHeroRef.current &&
        typeof practiceHeroRef.current.scrollIntoView === "function"
      ) {
        practiceHeroRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
      return
    }

    if (renderState === "review") {
      if (
        reviewHeroRef.current &&
        typeof reviewHeroRef.current.scrollIntoView === "function"
      ) {
        reviewHeroRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
    }
  }, [renderState])

  const stateLabels: Record<LearningWorkstationState, string> = {
    progress: "推进态",
    practice: "练习态",
    review: "复盘态",
  }

  const islandPanelContent = useMemo(() => {
    if (
      runtimeState === "preflight" ||
      runtimeState === "loading" ||
      runtimeState === "error"
    ) {
      return null
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(stateLabels) as LearningWorkstationState[]).map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => {
                if (overrideState) {
                  setOverrideState(state)
                  setPreviewState(null)
                  return
                }

                setPreviewState(state)
              }}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {stateLabels[state]}
            </button>
          ))}
        </div>
        {previewState ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setOverrideState(previewState)
                setPreviewState(null)
              }}
              className="rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              设为当前状态
            </button>
            <button
              type="button"
              onClick={clearManualState}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              恢复自动状态
            </button>
          </div>
        ) : overrideState ? (
          <button
            type="button"
            onClick={clearManualState}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            恢复自动状态
          </button>
        ) : null}
        <p className="text-xs text-slate-500">
          当前渲染态：{stateLabels[renderState]}
          {transitionIntent !== "none" ? ` · 转场：${transitionIntent}` : ""}
        </p>
      </div>
    )
  }, [
    clearManualState,
    overrideState,
    previewState,
    renderState,
    runtimeState,
    setOverrideState,
    setPreviewState,
    transitionIntent,
  ])

  const heroRef =
    renderState === "practice"
      ? practiceHeroRef
      : renderState === "review"
        ? reviewHeroRef
        : undefined
  const resolvedHero =
    typeof hero === "function" ? hero(renderState) : hero
  const resolvedActs =
    typeof acts === "function" ? acts(renderState) : acts
  const effectiveTransitionIntent =
    transitionIntentOverride ?? transitionIntent
  const ambientClassName = cn(
    "pointer-events-none absolute inset-x-6 top-2 z-0 h-[30rem] rounded-2xl opacity-70 blur-3xl transition-[transform,opacity,filter,background] duration-700 ease-out motion-reduce:transition-none",
    renderState === "progress" &&
      "bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.18),transparent_40%),radial-gradient(circle_at_75%_10%,rgba(59,130,246,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0))]",
    renderState === "practice" &&
      "bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.14),transparent_38%),radial-gradient(circle_at_50%_70%,rgba(15,23,42,0.6),transparent_62%)] opacity-55 saturate-150",
    renderState === "review" &&
      "bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.24),transparent_38%),radial-gradient(circle_at_75%_25%,rgba(14,165,233,0.16),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.08),rgba(255,255,255,0))]",
    effectiveTransitionIntent === "daybreak" &&
      "scale-[1.03] opacity-95 blur-3xl saturate-150",
    effectiveTransitionIntent === "inherit-hero" &&
      "translate-y-3 scale-[1.04] opacity-100 blur-2xl saturate-125",
  )
  const heroShellClassName = cn(
    "relative z-10 scroll-mt-32 transition-[transform,opacity,filter] duration-700 ease-out will-change-[transform,opacity] motion-reduce:transition-none",
    effectiveTransitionIntent === "daybreak" &&
      "translate-y-0 scale-100 opacity-100 saturate-110",
    effectiveTransitionIntent === "inherit-hero" &&
      "-translate-y-3 scale-[1.015] opacity-95",
  )
  const actsShellClassName = cn(
    "space-y-4 transition-[transform,opacity] duration-500 ease-out will-change-[transform,opacity] motion-reduce:transition-none",
    effectiveTransitionIntent === "inherit-hero" && "translate-y-2 opacity-85",
  )

  return (
    <div
      data-testid="learning-workstation"
      data-transition-intent={effectiveTransitionIntent}
      data-render-state={renderState}
      data-runtime-state={runtimeState}
      className="relative overflow-hidden pb-16"
    >
      <div aria-hidden="true" className={ambientClassName} />
      <div className="mx-auto max-w-7xl space-y-6 pt-6">
        <div className="flex justify-center">
          <DynamicContextIsland
            mode={renderState}
            stageTitle={stageTitle}
            stageMeta={stageMeta}
            controlsId="learning-workstation-island-panel"
            panelContent={islandPanelContent}
          />
        </div>
        <p className="sr-only">{subjectName} 学习工作台</p>
        <div
          ref={heroRef}
          data-testid={`learning-workstation-hero-${renderState}`}
          className={heroShellClassName}
        >
          {resolvedHero}
        </div>
        <div className={actsShellClassName}>
          {renderAct(resolvedActs.act1, visibility.act1)}
          {renderAct(resolvedActs.act2, visibility.act2)}
          {renderAct(resolvedActs.act3, visibility.act3)}
          {renderAct(resolvedActs.act4, visibility.act4)}
          {renderAct(resolvedActs.act5, visibility.act5)}
        </div>
      </div>
    </div>
  )
}
