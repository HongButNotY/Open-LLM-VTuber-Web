/* eslint-disable no-underscore-dangle */
import { useEffect } from 'react';
import { useMode } from '@/context/mode-context';
import { LAppDelegate } from '../../../WebSDK/src/lappdelegate';

// A held button with no mouse events for this long is treated as released
// (a native menu, for example, swallows the mouse-up).
const STALE_BUTTON_MS = 1500;

interface Point {
  x: number
  y: number
}

/** Whether the point is on the character, using the model's own hit test. */
function isOnModel(canvas: HTMLCanvasElement, point: Point): boolean {
  const model = (window as any).getLAppAdapter?.()?.getModel();
  const view = LAppDelegate.getInstance()?.getView() as any;
  if (!model || !view?._deviceToScreen || !canvas.clientWidth) return false;

  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / canvas.clientWidth;
  const modelX = view._deviceToScreen.transformX((point.x - rect.left) * scale);
  const modelY = view._deviceToScreen.transformY((point.y - rect.top) * scale);
  try {
    return model.anyhitTest(modelX, modelY) !== null || model.isHitOnModel(modelX, modelY);
  } catch {
    return false;
  }
}

/**
 * Something clickable is under the point: the character, or any panel drawn above the canvas
 * (input box, menus, dialogs, toasts). Empty space lets clicks through.
 */
function isInteractiveAt(point: Point): boolean {
  if (point.x < 0 || point.y < 0 || point.x > window.innerWidth || point.y > window.innerHeight) {
    return false;
  }
  const element = document.elementFromPoint(point.x, point.y);
  if (!element) return false;
  const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
  if (canvas && (element === canvas || element.contains(canvas))) {
    return isOnModel(canvas, point);
  }
  return true;
}

/**
 * Pet mode click-through. The window lets clicks through everywhere except on the character
 * and on open panels. The main process sends the cursor position several times a
 * second, so this stays right even if a mouse event is missed.
 */
export function usePetMousePassthrough(): void {
  const { mode } = useMode();
  const isPet = mode === 'pet';

  useEffect(() => {
    const ipc = (window as any).electron?.ipcRenderer;
    if (!isPet || !ipc) return undefined;

    let interactive: boolean | null = null;
    let buttonDown = false;
    let lastMouseEvent = 0;

    const report = (value: boolean) => {
      if (value === interactive) return;
      interactive = value;
      ipc.send('set-pet-interactive', value);
    };
    // Keep the window clickable while a button is held, so drags don't get cut off.
    const check = (point: Point) => report(buttonDown || isInteractiveAt(point));

    const onMove = (e: MouseEvent) => {
      lastMouseEvent = Date.now();
      buttonDown = e.buttons !== 0;
      check({ x: e.clientX, y: e.clientY });
    };
    const onDown = () => {
      lastMouseEvent = Date.now();
      buttonDown = true;
      report(true);
    };
    const onUp = (e: MouseEvent) => {
      buttonDown = false;
      check({ x: e.clientX, y: e.clientY });
    };
    const onCursor = (_event: unknown, point: Point) => {
      if (buttonDown && Date.now() - lastMouseEvent > STALE_BUTTON_MS) buttonDown = false;
      check(point);
    };
    const onBlur = () => {
      buttonDown = false;
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('blur', onBlur);
    const removeCursorListener = ipc.on('pet-cursor', onCursor);

    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mouseup', onUp, true);
      window.removeEventListener('blur', onBlur);
      if (typeof removeCursorListener === 'function') removeCursorListener();
      else ipc.removeAllListeners('pet-cursor');
    };
  }, [isPet]);
}
