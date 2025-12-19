'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';

interface Step {
  id: string;
  label: string;
  description?: string;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export default function ProgressSteps({
  steps,
  currentStep,
  onStepClick,
}: ProgressStepsProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && index <= currentStep;

          return (
            <div
              key={step.id}
              className={clsx(
                'flex-1 flex items-center',
                index < steps.length - 1 && 'pr-4'
              )}
            >
              {/* Step indicator */}
              <button
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={clsx(
                  'flex items-center gap-3 group',
                  isClickable && 'cursor-pointer'
                )}
              >
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                    isCompleted &&
                      'bg-[var(--color-forest)] text-white',
                    isCurrent &&
                      'bg-[var(--color-forest)] text-white ring-4 ring-[var(--color-forest)]/20',
                    !isCompleted &&
                      !isCurrent &&
                      'bg-[var(--color-parchment)] text-[var(--color-stone)]'
                  )}
                >
                  {isCompleted ? <Check size={18} /> : index + 1}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={clsx(
                      'text-sm font-medium',
                      isCurrent
                        ? 'text-[var(--color-ink)]'
                        : 'text-[var(--color-stone)]'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-[var(--color-stone)]">
                      {step.description}
                    </p>
                  )}
                </div>
              </button>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-4">
                  <div
                    className={clsx(
                      'h-0.5 rounded-full transition-all duration-500',
                      index < currentStep
                        ? 'bg-[var(--color-forest)]'
                        : 'bg-[var(--color-sand)]'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

