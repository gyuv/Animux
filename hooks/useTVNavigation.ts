import { useEffect } from 'react';

export const useTVNavigation = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const focusableElements = Array.from(
        document.querySelectorAll('button, [tabindex="0"], a, input')
      ) as HTMLElement[];
      
      const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % focusableElements.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
          break;
        case 'ArrowDown':
          // Simplified row skipping (assuming ~4 items per row)
          nextIndex = Math.min(currentIndex + 4, focusableElements.length - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(currentIndex - 4, 0);
          break;
        default:
          return;
      }

      e.preventDefault();
      focusableElements[nextIndex]?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
