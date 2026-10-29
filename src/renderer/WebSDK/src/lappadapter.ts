// @ts-nocheck
import { LAppLive2DManager } from "./lapplive2dmanager";
import { LAppModel } from "./lappmodel";
import * as LAppDefine from './lappdefine';
import { LAppPal } from "./lapppal";

import {
  ACubismMotion,
  FinishedMotionCallback
} from '@framework/motion/acubismmotion';
import {
  CubismMotionQueueEntryHandle,
  InvalidMotionQueueEntryHandleValue
} from '@framework/motion/cubismmotionqueuemanager';
import { CubismFramework } from '@framework/live2dcubismframework';
import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { LAppDelegate } from './lappdelegate';
import { canvas } from './lappglmanager';
import { deprecate } from "util";

export let s_adapter_instance : LAppAdapter | null | undefined = null;

export class LAppAdapter {
  public static getInstance(): LAppAdapter {
    if (s_adapter_instance == null) {
      s_adapter_instance = new LAppAdapter();
    }

    return s_adapter_instance;
  }

  /* gets */

  public getMgr(): LAppLive2DManager {
    return LAppLive2DManager.getInstance();
  }

  public getModel(): LAppModel | null {
    return this.getMgr().getModel(0);
  }

  public getIdManager() {
    return CubismFramework.getIdManager();
  }

  /* motion */

  public getMotionGroups(): string[] {
    let groups : string[] = [];
    for (let i = 0; i < this.getModel()?._modelSetting.getMotionGroupCount(); i++) {
      groups.push(this.getModel()?._modelSetting.getMotionGroupName(i) ?? "");
    }
    return groups;
  }

  public getMotionCount(group: string): number {
    return this.getModel()?._modelSetting.getMotionCount(group) ?? 0;
  }

  public startMotion(
    group: string,
    no: number,
    priority: number,
    onFinishedMotionHandler?: FinishedMotionCallback
  ): CubismMotionQueueEntryHandle {
    return this.getModel()?.startMotion(group, no, priority, onFinishedMotionHandler) ?? InvalidMotionQueueEntryHandleValue;
  }

  /* expression */

  public getExpressionCount(): number {
    return this.getModel()?._expressions.getSize() ?? 0;
  }

  public getExpressionName(index: number): string {
    return this.getModel()?._modelSetting?.getExpressionName(index) ?? '';
  }

  public setExpression(name: string): void {
    this.getModel()?.setExpression(name);
  }

  // @deprecated
  public nextChara(): void {
    this.getMgr().nextScene();
  }

  public setChara(ModelDir: string, ModelName: string): void {
    const modelPath = (ModelDir.endsWith('/') ? ModelDir : ModelDir + '/') + ModelName + '/';
    const modelJsonName = ModelName + '.model3.json';

    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]model Dir: ${modelPath}`);
    }

    this.getMgr().releaseAllModel();
    this.getMgr()._models.pushBack(new LAppModel());
    this.getMgr()._models.at(0)?.loadAssets(modelPath, modelJsonName);
  }

  /* model position manipulation */
  
  public getModelPosition(): { x: number, y: number } {
    const model = this.getModel();
    if (model && model._modelMatrix) {
      const matrix = model._modelMatrix.getArray();
      return {
        x: matrix[12],
        y: matrix[13]
      };
    }
    return { x: 0, y: 0 };
  }
  
  public setModelPosition(x: number, y: number): void {
    const model = this.getModel();
    if (model && model._modelMatrix) {
      const matrix = model._modelMatrix.getArray();
      
      // Update the translation components
      const newMatrix = [...matrix];
      newMatrix[12] = x;
      newMatrix[13] = y;
      
      // Set the matrix
      model._modelMatrix.setMatrix(newMatrix);
    }
  }

  /**
   * Bounding box of the visible model on the page, in CSS pixels.
   * Mirrors the projection built in LAppLive2DManager.onUpdate, then maps
   * every visible drawable vertex from model space to the canvas.
   */
  public getModelScreenBounds(): { left: number, right: number, top: number, bottom: number } | null {
    const model = this.getModel();
    const coreModel = model?.getModel();
    const view = LAppDelegate.getInstance().getView();
    if (!model || !coreModel || !canvas || !view?._viewMatrix) return null;

    const { width, height } = canvas;
    const projection = new CubismMatrix44();
    if (coreModel.getCanvasWidth() > 1.0 && width < height) {
      projection.scale(1.0, width / height);
    } else {
      projection.scale(height / width, 1.0);
    }
    projection.multiplyByMatrix(view._viewMatrix);
    projection.multiplyByMatrix(model.getModelMatrix());

    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (let i = 0; i < coreModel.getDrawableCount(); i++) {
      if (!coreModel.getDrawableDynamicFlagIsVisible(i) || coreModel.getDrawableOpacity(i) <= 0) continue;
      const vertices = coreModel.getDrawableVertices(i);
      for (let v = 0; v < vertices.length; v += 2) {
        const x = projection.transformX(vertices[v]);
        const y = projection.transformY(vertices[v + 1]);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (!Number.isFinite(minX)) return null;

    // Clip space (-1..1, y up) to CSS pixels.
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left + ((minX + 1) / 2) * rect.width,
      right: rect.left + ((maxX + 1) / 2) * rect.width,
      top: rect.top + ((1 - maxY) / 2) * rect.height,
      bottom: rect.top + ((1 - minY) / 2) * rect.height,
    };
  }

  // private _live2DMgr: LAppLive2DManager;
}