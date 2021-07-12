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
    if (+rewardInfo.auto_bond_amount >= 10) {
      str += this.unit.transform(+rewardInfo.auto_bond_amount, '1.0-2') + ' in auto compound pool';
    }
    if (+rewardInfo.stake_bond_amount >= 10) {
      if (str) {
        str += ' + ';
      }
      str += this.unit.transform(+rewardInfo.stake_bond_amount, '1.0-2') + ' in auto stake pool';
    }
    return str;
  }

}
