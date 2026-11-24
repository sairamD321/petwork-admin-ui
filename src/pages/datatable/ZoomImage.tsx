import { useRef, type ReactNode } from 'react';
import classes from './ZoomImage.module.css';

interface ZoomImageProps {
  src: string;
  alt: string;
  /** Extras drawn over the picture (e.g. the discount ribbon). */
  children?: ReactNode;
  /** How much the side panel magnifies. */
  zoom?: number;
}

/**
 * The product picture with hover zoom: a lens follows the cursor and a panel beside the picture
 * shows that area magnified. The cursor position goes straight into CSS variables (once per frame),
 * so moving around never re-renders React and stays smooth.
 */
export default function ZoomImage({ src, alt, children, zoom = 2.5 }: ZoomImageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function onMove(event: React.MouseEvent<HTMLDivElement>) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      // Lens = 1/zoom of the picture, centred on the cursor but kept inside the picture.
      const lens = 1 / zoom;
      const left = Math.min(Math.max(x - lens / 2, 0), 1 - lens);
      const top = Math.min(Math.max(y - lens / 2, 0), 1 - lens);
      wrap.style.setProperty('--lens-x', `${left * 100}%`);
      wrap.style.setProperty('--lens-y', `${top * 100}%`);
      // The panel shows exactly the lens area: shift the enlarged copy by the lens offset.
      wrap.style.setProperty('--shift-x', `${-left * zoom * 100}%`);
      wrap.style.setProperty('--shift-y', `${-top * zoom * 100}%`);
    });
  }

  return (
    <div ref={wrapRef} className={classes.wrap} style={{ '--zoom': zoom } as React.CSSProperties}>
      <div className={classes.stage} onMouseMove={onMove}>
        {children}
        {/* key: a new picture fades in instead of snapping. */}
        <img key={src} src={src} alt={alt} className={classes.image} draggable={false} />
        <span className={classes.lens} aria-hidden />
      </div>
      <div className={classes.pane} aria-hidden>
        <img src={src} alt="" className={classes.paneImage} draggable={false} />
      </div>
    </div>
  );
}
