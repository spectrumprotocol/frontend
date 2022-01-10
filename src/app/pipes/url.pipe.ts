import { Pipe, PipeTransform } from '@angular/core';

const MIRROR_ICON_URL = 'https://whitelist.mirror.finance/images';

@Pipe({
  name: 'url'
})
export class UrlPipe implements PipeTransform {

  transform(symbol: string, type: string, dex?: string) {
    if (!symbol) {
      return symbol;
    }
    switch (type) {
      case 'icon':
        if (symbol.startsWith('m')) {
          return `${MIRROR_ICON_URL}/${symbol.slice(1)}.png`;
        }
        switch (symbol) {
          case 'UST': return '/assets/UST.png';
          case 'Spectrum': return '/assets/SPEC.png';
          case 'SPEC': return '/assets/SPEC.png';
          case 'Anchor': return 'https://whitelist.anchorprotocol.com/logo/ANC.png';
          case 'ANC': return 'https://whitelist.anchorprotocol.com/logo/ANC.png';
          case 'TTN': return 'https://whitelist.anchorprotocol.com/logo/ANC.png';
          case 'Pylon': return 'https://assets.pylon.rocks/logo/MINE.png';
          case 'MINE': return 'https://assets.pylon.rocks/logo/MINE.png';
          case 'Mirror': return `https://whitelist.mirror.finance/icon/MIR.png`;
          case 'Terraworld': return `https://terraoffice.world/twd_logo.png`;
          case 'TWD': return `https://terraoffice.world/twd_logo.png`;
          case 'MYMY': return `https://terraoffice.world/twd_logo.png`;
          case 'Valkyrie': return 'https://app.valkyrieprotocol.com/icon_vkr.png';
          case 'VKR': return 'https://app.valkyrieprotocol.com/icon_vkr.png';
          case 'Nexus': return `https://terra.nexusprotocol.app/logo.svg`;
          case 'Psi': return `https://terra.nexusprotocol.app/logo.svg`;
          case 'nLuna': return `https://terra.nexusprotocol.app/nLuna.svg`;
          case 'nETH': return `https://terra.nexusprotocol.app/nEth.svg`;
          case 'Orion': return `https://orion.money/img/ico-tabs-06.svg`;
          case 'ORION': return `https://orion.money/img/ico-tabs-06.svg`;
          case 'ORNb': return `https://orion.money/img/ico-tabs-06.svg`;
          case 'KUJI': return `https://assets.kujira.app/kuji.png`;
          case 'Kujira': return `https://assets.kujira.app/kuji.png`;
          case 'bPsiDP-24m': return 'https://assets.pylon.rocks/logo/bPsiDP.png';
          case 'Pylon Liquid Pool': return 'https://assets.pylon.rocks/logo/MINE.png';
          case 'bLUNA': return `https://whitelist.anchorprotocol.com/logo/bLUNA.png`;
          case 'LUNA': return `https://assets.terra.money/icon/60/Luna.png`;
          case 'ASTRO': return `https://astroport.fi/astro_logo.png`;
          case 'Astroport': return `https://astroport.fi/astro_logo.png`;
          default: return `${MIRROR_ICON_URL}/${symbol}.png`;
        }
      case 'trade':
        if (symbol.startsWith('m')) {
          return 'https://terra.mirror.finance/trade#buy';
        }
        switch (symbol) {
          case 'SPEC': return '/trade';
          case 'ANC': return 'https://app.anchorprotocol.com/trade/buy';
          case 'TTN': return 'https://app.anchorprotocol.com/trade/buy';
          case 'MINE': return 'https://app.pylon.money/trade/buy';
          case 'TWD': return `https://app.terraoffice.world/Gov/trade`;
          case 'MYMY': return `https://app.terraoffice.world/Gov/trade`;
          case 'VKR': return 'https://app.valkyrieprotocol.com/trade';
          case 'Psi': return `https://terra.nexusprotocol.app/`;
          case 'nLuna': return `https://terra.nexusprotocol.app/`;
          case 'nETH': return `https://terra.nexusprotocol.app/`;
          case 'ORION': return `https://terra.orion.money/`;
          case 'ORNb': return `https://terra.orion.money/`;
          case 'KUJI': return `https://blue.kujira.app/`;
          case 'bPsiDP-24m': return 'https://app.terraswap.io/#Swap';
          case 'bLUNA': return `https://app.astroport.fi/swap?from=uluna&to=terra1kc87mu460fwkqte29rquh4hc20m54fxwtsx7gp`;
          case 'LUNA': return `https://app.astroport.fi/swap?from=uusd&to=uluna`;
          case 'ASTRO': return `https://app.astroport.fi/swap?from=uusd&to=terra1xj49zyqrwpv5k928jwfpfy2ha668nwdgkwlrg3`;
          default: {
            if (dex === 'Astroport') {
              return 'https://app.astroport.fi/swap';
            } else {
              return 'https://app.terraswap.io/#Swap';
            }
          }
        }
      case 'provideLP':
        switch (symbol) {
          case 'bLUNA': return `https://app.astroport.fi/pools/terra1j66jatn3k50hjtg2xemnjm8s7y8dws9xqa5y8w`;
          case 'LUNA': return `https://app.astroport.fi/pools/terra1m6ywlgn6wrjuagcmmezzz2a029gtldhey5k552`;
          case 'ASTRO': return `https://app.astroport.fi/pools/terra1l7xu2rl3c7qmtx3r5sd2tz25glf6jh8ul7aag7`;
          default: {
            if (dex === 'Astroport') {
              return 'https://app.astroport.fi/pools';
            } else {
              return 'https://app.terraswap.io/#Provide';
            }
          }
        }
      case 'mint':
        if (symbol.startsWith('m')) {
          return 'https://terra.mirror.finance/mint#open';
        } else if (symbol.startsWith('n')) {
          return `https://terra.nexusprotocol.app/vaults`;
        }
        return undefined;
      case 'deposit_pylon_gateway':
        switch (symbol) {
          case 'bPsiDP-24m': return 'https://gateway.pylon.money/tokens/psi';
        }
        return undefined;
    }
  }

}
