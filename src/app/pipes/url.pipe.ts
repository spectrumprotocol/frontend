import { Pipe, PipeTransform } from '@angular/core';

const MIRROR_ICON_URL = 'https://whitelist.mirror.finance/images';

@Pipe({
  name: 'url'
})
export class UrlPipe implements PipeTransform {

  transform(symbol: string, type: string) {
    if (!symbol) {
      return symbol;
    }
    switch (type) {
      case 'icon':
        if (symbol.startsWith('m')) {
          return `${MIRROR_ICON_URL}/${symbol.slice(1)}.png`;
        }
        switch (symbol) {
          case 'SPEC': return '/assets/SPEC.png';
          default: return `${MIRROR_ICON_URL}/${symbol}.png`;
        }
      case 'trade':
        if (symbol.startsWith('m')) {
          return 'https://terra.mirror.finance/trade#buy';
        }
        switch (symbol) {
          case 'SPEC': return '/trade';
          default: return 'https://terra.mirror.finance/trade#buy';
        }
      case 'mint':
        if (symbol.startsWith('m')) {
          return 'https://terra.mirror.finance/mint#open';
        }
        return undefined;
      case 'pool':
        if (symbol.startsWith('m')) {
          return 'https://terra.mirror.finance/pool#provide';
        }
        switch (symbol) {
          case 'SPEC': return '/pool';
          default: return 'https://terra.mirror.finance/pool#provide';
        }
    }
  }

}
