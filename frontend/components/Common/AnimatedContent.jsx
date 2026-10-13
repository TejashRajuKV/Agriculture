import React, { useRef, useEffect, useState } from 'react';

export const AnimatedContent = ({
  children,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.6,
  ease = 'ease-out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
}) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(ref.current);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  const getTransform = () => {
    if (!inView) {
      const dist = reverse ? -distance : distance;
      const translate = direction === 'horizontal' ? `translateX(${dist}px)` : `translateY(${dist}px)`;
      return `${translate} scale(${scale})`;
    }
    return 'translate(0) scale(1)';
  };

  // Map "bounce.out" to a springy cubic-bezier approximation
  const transitionEase = ease === 'bounce.out' 
    ? 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
    : ease;

  return (
    <div
      ref={ref}
      style={{
        transform: getTransform(),
        opacity: animateOpacity ? (inView ? 1 : initialOpacity) : 1,
        transition: `transform ${duration}s ${transitionEase} ${delay}s, opacity ${duration}s ${transitionEase} ${delay}s`,
        willChange: 'transform, opacity'
      }}
    >
      {children}
    </div>
  );
};