import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const ToastPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      let el = document.getElementById('toast-portal-root');
      let created = false;
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast-portal-root';
        el.style.position = 'fixed';
        el.style.top = '0';
        el.style.left = '0';
        el.style.right = '0';
        el.style.bottom = '0';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '99999999';
        document.body.appendChild(el);
        created = true;
      }
      setContainer(el);

      return () => {
        if (created && el && document.body.contains(el)) {
          document.body.removeChild(el);
        }
      };
    }
  }, []);

  if (!container) return null;
  return createPortal(children as any, container) as any;
};
