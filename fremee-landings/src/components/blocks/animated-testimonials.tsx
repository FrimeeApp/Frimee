"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Quote, Star } from "lucide-react"
import { motion, useAnimation, useInView, type Variants } from "framer-motion"
import { useEffect, useRef, useState } from "react"

export interface Testimonial {
  id: number
  name: string
  role: string
  company: string
  content: string
  rating: number
  avatar: string
}

export interface AnimatedTestimonialsProps {
  title?: string
  subtitle?: string
  badgeText?: string
  testimonials?: Testimonial[]
  autoRotateInterval?: number
  className?: string
}

export function AnimatedTestimonials({
  title = "Lo que dicen nuestros usuarios",
  subtitle = "Los primeros en probar Frimee nos cuentan cómo cambió la forma de organizar sus planes.",
  badgeText = "Primeros usuarios",
  testimonials = [],
  autoRotateInterval = 5000,
  className,
}: AnimatedTestimonialsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 })
  const controls = useAnimation()

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" as const },
    },
  }

  useEffect(() => {
    if (isInView) controls.start("visible")
  }, [isInView, controls])

  useEffect(() => {
    if (autoRotateInterval <= 0 || testimonials.length <= 1) return
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length)
    }, autoRotateInterval)
    return () => clearInterval(interval)
  }, [autoRotateInterval, testimonials.length])

  if (testimonials.length === 0) return null

  return (
    <section ref={sectionRef} className={`v3-section ${className ?? ""}`}>
      <div className="v3-section-inner">
        <motion.div
          initial="hidden"
          animate={controls}
          variants={containerVariants}
          className="v3-testimonials-layout"
        >
          {/* Left — heading & controls */}
          <motion.div variants={itemVariants} className="v3-testimonials-left">
            
            <h2 style={{ maxWidth: "12ch" }}>{title}</h2>
            <p className="v3-testimonials-subtitle">{subtitle}</p>
            <div className="v3-testimonials-dots">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`v3-testimonials-dot ${activeIndex === i ? "active" : ""}`}
                  aria-label={`Ver testimonio ${i + 1}`}
                />
              ))}
            </div>
          </motion.div>

          {/* Right — testimonial cards */}
          <motion.div variants={itemVariants} className="v3-testimonials-cards">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.id}
                className="v3-testimonial-card"
                initial={{ opacity: 0, x: 80 }}
                animate={{
                  opacity: activeIndex === i ? 1 : 0,
                  x: activeIndex === i ? 0 : 80,
                  scale: activeIndex === i ? 1 : 0.92,
                }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{ zIndex: activeIndex === i ? 10 : 0 }}
              >
                {/* Stars */}
                <div className="v3-testimonial-stars">
                  {Array(t.rating).fill(0).map((_, si) => (
                    <Star key={si} size={18} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>

                {/* Quote */}
                <div className="v3-testimonial-body">
                  <Quote size={32} className="v3-testimonial-quote-icon" />
                  <p>"{t.content}"</p>
                </div>

                <Separator />

                {/* Author */}
                <div className="v3-testimonial-author">
                  <Avatar className="v3-testimonial-avatar">
                    <AvatarImage src={t.avatar} alt={t.name} />
                    <AvatarFallback>{t.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="v3-testimonial-name">{t.name}</p>
                    <p className="v3-testimonial-role">{t.role} · {t.company}</p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Decorative blobs */}
            <div className="v3-testimonial-blob v3-testimonial-blob-bl" />
            <div className="v3-testimonial-blob v3-testimonial-blob-tr" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
