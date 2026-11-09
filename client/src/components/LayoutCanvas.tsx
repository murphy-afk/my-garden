import { useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { MoveDiagonal2 } from 'lucide-react';
import { areaGrid, areaGridHeightCm, areaGridWidthCm, type AreaGeometry, type GardenArea } from '../api/areas';

/** How far the pointer must travel before a press counts as a drag, not a click. */
const dragThresholdPx = 4;

const cellWidthPx = areaGrid.cellWidthCm * areaGrid.pxPerCm;
const cellHeightPx = areaGrid.cellHeightCm * areaGrid.pxPerCm;
const canvasWidthPx = areaGrid.columns * cellWidthPx;
const canvasHeightPx = areaGrid.rows * cellHeightPx;

type DragState = {
  areaId: number;
  mode: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  startGeometry: AreaGeometry;
  current: AreaGeometry;
  moved: boolean;
};

type LayoutCanvasProps = {
  /** The areas to draw, active only: archived areas leave the layout. */
  areas: GardenArea[];
  /** Saves a moved or resized area; the page owns the API call. */
  onSave: (area: GardenArea, geometry: AreaGeometry) => void;
  /** Opens the edit form, with the element that should get focus back. */
  onEdit: (area: GardenArea, trigger: HTMLElement) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounds to the nearest resize step, so dragged sizes stay round numbers. */
function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** The last column an area of this width can start in and still fit the grid. */
function maxGridXFor(widthCm: number): number {
  return Math.max(0, Math.floor(areaGrid.columns - widthCm / areaGrid.cellWidthCm));
}

function maxGridYFor(depthCm: number): number {
  return Math.max(0, Math.floor(areaGrid.rows - depthCm / areaGrid.cellHeightCm));
}

function maxWidthCmAt(gridX: number): number {
  return areaGridWidthCm - gridX * areaGrid.cellWidthCm;
}

function maxHeightCmAt(gridY: number): number {
  return areaGridHeightCm - gridY * areaGrid.cellHeightCm;
}

/** The position after a drag, snapped to whole slots and kept inside the grid. */
function movedGeometry(start: AreaGeometry, dx: number, dy: number): AreaGeometry {
  const gridX = clamp(start.gridX + Math.round(dx / cellWidthPx), 0, maxGridXFor(start.widthCm));
  const gridY = clamp(start.gridY + Math.round(dy / cellHeightPx), 0, maxGridYFor(start.depthCm));
  return { ...start, gridX, gridY };
}

/** The size after a drag, snapped to the resize step and kept inside the grid. */
function resizedGeometry(start: AreaGeometry, dx: number, dy: number): AreaGeometry {
  const widthCm = clamp(
    snap(start.widthCm + dx / areaGrid.pxPerCm, areaGrid.resizeStepCm),
    areaGrid.minAreaCm,
    maxWidthCmAt(start.gridX),
  );
  const depthCm = clamp(
    snap(start.depthCm + dy / areaGrid.pxPerCm, areaGrid.resizeStepCm),
    areaGrid.minAreaCm,
    maxHeightCmAt(start.gridY),
  );
  return { ...start, widthCm, depthCm };
}

function geometryEquals(a: AreaGeometry, b: AreaGeometry): boolean {
  return a.gridX === b.gridX && a.gridY === b.gridY && a.widthCm === b.widthCm && a.depthCm === b.depthCm;
}

/** Arrow keys as a step across the grid, for moving and for resizing. */
const arrowSteps: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function LayoutCanvas({ areas, onSave, onEdit }: LayoutCanvasProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Set when a drag ends, so the click the browser fires next does not open the form.
  const suppressClickRef = useRef(false);

  function geometryOf(area: GardenArea): AreaGeometry {
    if (drag !== null && drag.areaId === area.id) return drag.current;
    return { gridX: area.gridX, gridY: area.gridY, widthCm: area.widthCm, depthCm: area.depthCm };
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, area: GardenArea, mode: DragState['mode']): void {
    if (event.button !== 0) return;
    // A keypress follows any earlier drag, so stale suppression cannot swallow it.
    suppressClickRef.current = false;

    const geometry = geometryOf(area);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      areaId: area.id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: geometry,
      current: geometry,
      moved: false,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>): void {
    if (drag === null || event.pointerId !== drag.pointerId) return;
    // The button was released outside the window, so no pointerup will arrive here.
    if ((event.buttons & 1) === 0) {
      finishDrag(drag);
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) < dragThresholdPx && Math.abs(dy) < dragThresholdPx) return;

    const current =
      drag.mode === 'move' ? movedGeometry(drag.startGeometry, dx, dy) : resizedGeometry(drag.startGeometry, dx, dy);
    setDrag({ ...drag, moved: true, current });
  }

  /** Ends a drag: saves the new geometry, or lets a plain click open the form. */
  function finishDrag(finished: DragState): void {
    setDrag(null);
    if (!finished.moved) return;

    suppressClickRef.current = true;
    const area = areas.find((item) => item.id === finished.areaId);
    if (area !== undefined && !geometryEquals(finished.startGeometry, finished.current)) {
      onSave(area, finished.current);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>): void {
    if (drag === null || event.pointerId !== drag.pointerId) return;
    finishDrag(drag);
  }

  /** An interrupted gesture discards the preview and keeps the saved values. */
  function handlePointerCancel(event: PointerEvent<HTMLButtonElement>): void {
    if (drag === null || event.pointerId !== drag.pointerId) return;
    setDrag(null);
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>, area: GardenArea): void {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onEdit(area, event.currentTarget);
  }

  /** Arrow keys move the area one slot; shift with an arrow key resizes it. */
  function handleBodyKeyDown(event: KeyboardEvent<HTMLButtonElement>, area: GardenArea): void {
    const step = arrowSteps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    suppressClickRef.current = false;

    const geometry = geometryOf(area);
    const [dx, dy] = step;
    const next: AreaGeometry = event.shiftKey
      ? {
          ...geometry,
          widthCm: clamp(geometry.widthCm + dx * areaGrid.resizeStepCm, areaGrid.minAreaCm, maxWidthCmAt(geometry.gridX)),
          depthCm: clamp(
            geometry.depthCm + dy * areaGrid.resizeStepCm,
            areaGrid.minAreaCm,
            maxHeightCmAt(geometry.gridY),
          ),
        }
      : movedGeometry(geometry, dx * cellWidthPx, dy * cellHeightPx);

    if (!geometryEquals(geometry, next)) onSave(area, next);
  }

  /** On the resize handle the arrow keys always change the size. */
  function handleResizeKeyDown(event: KeyboardEvent<HTMLButtonElement>, area: GardenArea): void {
    const step = arrowSteps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    suppressClickRef.current = false;

    const geometry = geometryOf(area);
    const [dx, dy] = step;
    const next: AreaGeometry = {
      ...geometry,
      widthCm: clamp(geometry.widthCm + dx * areaGrid.resizeStepCm, areaGrid.minAreaCm, maxWidthCmAt(geometry.gridX)),
      depthCm: clamp(geometry.depthCm + dy * areaGrid.resizeStepCm, areaGrid.minAreaCm, maxHeightCmAt(geometry.gridY)),
    };

    if (!geometryEquals(geometry, next)) onSave(area, next);
  }

  // The geometry comes from data, so background sizing is set here while the
  // grid lines themselves live in the stylesheet.
  const canvasStyle = {
    width: canvasWidthPx,
    height: canvasHeightPx,
    backgroundSize: `${cellWidthPx}px ${cellHeightPx}px`,
  } as CSSProperties;

  return (
    <div className="layout__frame">
      <div className="layout__canvas" style={canvasStyle} role="group" aria-label="Garden layout">
        {areas.map((area) => {
          const geometry = geometryOf(area);
          const dragging = drag !== null && drag.areaId === area.id;
          const style: CSSProperties = {
            left: geometry.gridX * cellWidthPx,
            top: geometry.gridY * cellHeightPx,
            width: geometry.widthCm * areaGrid.pxPerCm,
            height: geometry.depthCm * areaGrid.pxPerCm,
          };

          return (
            <div key={area.id} className={dragging ? 'layout__area layout__area--dragging' : 'layout__area'} style={style}>
              <button
                type="button"
                className="layout__area-body"
                aria-label={`Edit ${area.name}, ${area.widthCm} by ${area.depthCm} centimetres at column ${area.gridX}, row ${area.gridY}. Arrow keys move it, shift with arrow keys resizes it.`}
                onPointerDown={(event) => beginDrag(event, area, 'move')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onClick={(event) => handleClick(event, area)}
                onKeyDown={(event) => handleBodyKeyDown(event, area)}>
                <span className="layout__area-name">{area.name}</span>
                <span className="layout__area-size">{area.widthCm} x {area.depthCm} cm</span>
              </button>
              <button
                type="button"
                className="layout__area-resize"
                aria-label={`Resize ${area.name}`}
                title="Drag, or use the arrow keys, to resize"
                onPointerDown={(event) => beginDrag(event, area, 'resize')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onClick={(event) => handleClick(event, area)}
                onKeyDown={(event) => handleResizeKeyDown(event, area)}>
                <MoveDiagonal2 aria-hidden="true" size={12} />
              </button>
            </div>
          );
        })}

        {areas.length === 0 && <p className="layout__empty">No active areas to draw.</p>}
      </div>
    </div>
  );
}
