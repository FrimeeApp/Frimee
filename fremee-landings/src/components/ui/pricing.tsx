"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CheckCircle, Star, Info } from "lucide-react";
import Link from "next/link";
import { motion, type Transition } from "framer-motion";

type FREQUENCY = "monthly" | "yearly";
const frequencies: FREQUENCY[] = ["monthly", "yearly"];

export interface Plan {
  name: string;
  info: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: {
    text: string;
    tooltip?: string;
  }[];
  btn: {
    text: string;
    href: string;
  };
  highlighted?: boolean;
}

interface PricingSectionProps extends React.ComponentProps<"div"> {
  plans: Plan[];
  heading: string;
  description?: string;
}

export function PricingSection({
  plans,
  heading,
  description,
  ...props
}: PricingSectionProps) {
  const [frequency, setFrequency] = React.useState<FREQUENCY>("monthly");

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-8",
        props.className,
      )}
      {...props}
    >
      <div className="v3-section-inner">
        <h2 className="v3-pricing-heading v3-ac" style={{ marginBottom: "1rem" }}>{heading}</h2>
        {description && (
          <p className="v3-pricing-desc v3-ac">{description}</p>
        )}
        <div className="v3-ac flex justify-center" style={{ marginTop: "2rem" }}>
          <PricingFrequencyToggle
            frequency={frequency}
            setFrequency={setFrequency}
          />
        </div>
      </div>

      <div className="v3-section-inner">
        <div className="v3-pricing-grid">
          {plans.map((plan) => (
            <PricingCard
              plan={plan}
              key={plan.name}
              frequency={frequency}
              className="v3-ac"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type PricingFrequencyToggleProps = React.ComponentProps<"div"> & {
  frequency: FREQUENCY;
  setFrequency: React.Dispatch<React.SetStateAction<FREQUENCY>>;
};

export function PricingFrequencyToggle({
  frequency,
  setFrequency,
  ...props
}: PricingFrequencyToggleProps) {
  return (
    <div
      className={cn("v3-pricing-toggle", props.className)}
      {...props}
    >
      {frequencies.map((freq) => (
        <button
          key={freq}
          onClick={() => setFrequency(freq)}
          className={cn(
            "v3-pricing-toggle-btn",
            frequency === freq && "active",
          )}
        >
          {freq === "monthly" ? "Mensual" : "Anual"}
          {freq === "yearly" && (
            <span className="v3-pricing-toggle-badge">−20%</span>
          )}
        </button>
      ))}
    </div>
  );
}

type PricingCardProps = React.ComponentProps<"div"> & {
  plan: Plan;
  frequency?: FREQUENCY;
};

export function PricingCard({
  plan,
  className,
  frequency = frequencies[0],
  ...props
}: PricingCardProps) {
  const isHighlighted = plan.highlighted;
  const discount =
    frequency === "yearly" && plan.price.monthly > 0
      ? Math.round(
          ((plan.price.monthly * 12 - plan.price.yearly) /
            (plan.price.monthly * 12)) *
            100,
        )
      : 0;

  return (
    <div
      className={cn(
        "v3-pricing-card",
        isHighlighted && "highlighted",
        className,
      )}
      {...props}
    >
      {isHighlighted && <BorderTrail size={90} />}

      {/* Header */}
      <div className={cn("v3-pricing-card-header", isHighlighted && "highlighted")}>
        <div className="v3-pricing-card-badges">
          {isHighlighted && (
            <span className="v3-pricing-popular">
              <Star size={11} fill="currentColor" /> Popular
            </span>
          )}
          {discount > 0 && (
            <span className="v3-pricing-discount">{discount}% off</span>
          )}
        </div>
        <p className="v3-pricing-plan-name">{plan.name}</p>
        <p className="v3-pricing-plan-info">{plan.info}</p>
        <div className="v3-pricing-price">
          {plan.price[frequency] === 0 ? (
            <span className="v3-pricing-amount">Gratis</span>
          ) : (
            <>
              <span className="v3-pricing-amount">
                {plan.price[frequency].toFixed(2).replace(".", ",")} €
              </span>
              <span className="v3-pricing-period">
                /{frequency === "monthly" ? "mes" : "año"}
              </span>
            </>
          )}
        </div>
        {frequency === "yearly" && plan.price.monthly > 0 && (
          <p className="v3-pricing-yearly-note">
            {(plan.price.yearly / 12).toFixed(2).replace(".", ",")} €/mes facturado anualmente
          </p>
        )}
      </div>

      {/* Features */}
      <div className={cn("v3-pricing-features", isHighlighted && "highlighted")}>
        <TooltipProvider>
          {plan.features.map((feature, idx) => (
            <div key={idx} className="v3-pricing-feature">
              <CheckCircle
                size={16}
                className="v3-pricing-check"
                strokeWidth={2.5}
              />
              {feature.tooltip ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <span className="v3-pricing-feature-text has-tooltip">
                      {feature.text}
                      <Info size={12} className="v3-pricing-info-icon" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{feature.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="v3-pricing-feature-text">{feature.text}</span>
              )}
            </div>
          ))}
        </TooltipProvider>
      </div>

      {/* CTA */}
      <div className={cn("v3-pricing-card-footer", isHighlighted && "highlighted")}>
        <Button
          className="w-full"
          variant={isHighlighted ? "default" : "outline"}
          size="lg"
          asChild
        >
          <Link href={plan.btn.href}>{plan.btn.text}</Link>
        </Button>
      </div>
    </div>
  );
}

type BorderTrailProps = {
  className?: string;
  size?: number;
  transition?: Transition;
  delay?: number;
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
};

export function BorderTrail({
  className,
  size = 60,
  transition,
  delay,
  onAnimationComplete,
  style,
}: BorderTrailProps) {
  const BASE_TRANSITION: Transition = {
    repeat: Infinity,
    duration: 4,
    ease: "linear",
  };

  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]">
      <motion.div
        className={cn("absolute aspect-square", className)}
        style={{
          width: size,
          background:
            "linear-gradient(90deg, var(--v3-purple), color-mix(in srgb, var(--v3-purple) 40%, transparent))",
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ...style,
        }}
        animate={{ offsetDistance: ["0%", "100%"] }}
        transition={{ ...(transition ?? BASE_TRANSITION), delay }}
        onAnimationComplete={onAnimationComplete}
      />
    </div>
  );
}
