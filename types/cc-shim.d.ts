declare module 'cc' {
  export class Component {
    node: Node;
    scheduleOnce(callback: () => void, delay?: number): void;
  }
  export class Node {
    constructor(name?: string);
    active: boolean;
    angle: number;
    children: Node[];
    name: string;
    parent: Node | null;
    layer: number;
    setPosition(x: number | Vec3, y?: number, z?: number): void;
    on(type: string, callback: (...args: any[]) => void, target?: any): void;
    off(type: string, callback: (...args: any[]) => void, target?: any): void;
    getComponent<T>(component: new (...args: any[]) => T): T | null;
    addComponent<T>(component: new (...args: any[]) => T): T;
    addChild(child: Node): void;
    removeAllChildren(): void;
  }
  export namespace Node {
    export const EventType: {
      TOUCH_END: string;
    };
  }
  export class Label {
    node: Node;
    string: string;
    fontSize: number;
    lineHeight: number;
    horizontalAlign: number;
    verticalAlign: number;
    color: Color;
    fontFamily: string;
    isBold: boolean;
  }
  export class Button {
    node: Node;
  }
  export class Toggle {
    isChecked: boolean;
  }
  export class SpriteFrame {}
  export class Sprite {
    color: Color;
    spriteFrame: SpriteFrame | null;
    sizeMode: number;
  }
  export namespace Sprite {
    export const SizeMode: {
      CUSTOM: number;
    };
  }
  export class Graphics {
    fillColor: Color;
    strokeColor: Color;
    lineWidth: number;
    clear(): void;
    rect(x: number, y: number, width: number, height: number): void;
    roundRect(x: number, y: number, width: number, height: number, radius: number): void;
    circle(cx: number, cy: number, r: number): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    close(): void;
    fill(): void;
    stroke(): void;
  }
  export class UITransform {
    setContentSize(width: number, height: number): void;
    convertToNodeSpaceAR(worldPoint: Vec3): Vec3;
  }
  export class Color {
    constructor(r?: number, g?: number, b?: number, a?: number);
    static WHITE: Color;
    static BLACK: Color;
  }
  export class JsonAsset {
    json: unknown;
  }
  export class Prefab {}
  export class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
  }
  export const resources: {
    load(path: string, callback: (error: Error | null, asset: JsonAsset) => void): void;
    load<T>(path: string, type: new (...args: any[]) => T, callback: (error: Error | null, asset: T) => void): void;
  };
  export const tween: <T extends object>(target: T) => {
    to(duration: number, props: Partial<T>, options?: Record<string, unknown>): any;
    call(callback: () => void): any;
    start(): any;
  };
  export const director: {
    loadScene(name: string): void;
  };
  export const Layers: {
    Enum: {
      UI_2D: number;
    };
  };
  export const _decorator: {
    ccclass(name: string): ClassDecorator;
    property(type?: any): PropertyDecorator;
  };
  export function instantiate<T>(prefab: T): Node;
}
