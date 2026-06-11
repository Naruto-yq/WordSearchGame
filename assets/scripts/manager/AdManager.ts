import { IPlatform } from '../platform/IPlatform';

export class AdManager {
  constructor(
    private readonly platform: IPlatform,
    private readonly rewardAdUnitId = '',
    private readonly interstitialAdUnitId = '',
  ) {}

  async showRewardAd(_scene: string): Promise<boolean> {
    return this.platform.showRewardVideo(this.rewardAdUnitId);
  }

  async showInterstitial(): Promise<void> {
    return this.platform.showInterstitial(this.interstitialAdUnitId);
  }
}
