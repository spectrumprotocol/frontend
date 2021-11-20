import { Pipe, PipeTransform } from '@angular/core';
import { RewardInfoResponseItem } from '../services/farm_info/farm-info.service';
import { UnitPipe } from './unit.pipe';

@Pipe({
  name: 'rewardInfo'
})
export class RewardInfoPipe implements PipeTransform {

  constructor(
    private unit: UnitPipe,
  ) { }

  transform(rewardInfo: RewardInfoResponseItem): string {
    if (!rewardInfo) {
      return undefined;
    }
    let str = '';
    if (+rewardInfo.stake_bond_amount >= 10) {
      str += this.unit.transform(+rewardInfo.stake_bond_amount, 6, '1.0-6') + ' in auto stake pool';
    }
    if (+rewardInfo.auto_bond_amount >= 10) {
      if (str) {
        str += ' + ';
      }
      str += this.unit.transform(+rewardInfo.auto_bond_amount, 6, '1.0-6') + ' in auto compound pool';
    }
    return str;
  }

}
