import { DouyinPlatform } from './DouyinPlatform';
import { IPlatform } from './IPlatform';
import { WebPlatform } from './WebPlatform';
import { WechatPlatform } from './WechatPlatform';

declare const wx: any;
declare const tt: any;

export class PlatformFactory {
  static create(): IPlatform {
    if (typeof wx !== 'undefined') {
      return new WechatPlatform();
    }

    if (typeof tt !== 'undefined') {
      return new DouyinPlatform();
    }

    return new WebPlatform();
  }
}
