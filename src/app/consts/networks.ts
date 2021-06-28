export interface ISettings {
  specToken: string;
  specPool: string;
  specLpToken: string;
  gov: string;
  mirrorFarm: string;
  mirrorStaking: string;
  mirrorGov: string;
  mirrorToken: string;
  specFarm: string;
  terraSwapFactory: string;
  staker: string;
  lcd: string;
  fcd: string;
  mirrorGraph: string;
  chainID: string;
}
export const networks: Record<string, ISettings> = {
  mainnet: {
    specToken: 'terra1s5eczhe0h0jutf46re52x5z4r03c8hupacxmdr',
    specPool: 'terra1tn8ejzw8kpuc87nu42f6qeyen4c7qy35tl8t20',
    specLpToken: 'terra1y9kxxm97vu4ex3uy0rgdr5h2vt7aze5sqx7jyl',
    gov: 'terra1dpe4fmcz2jqk6t50plw0gqa2q3he2tj6wex5cl',
    mirrorFarm: 'terra1kehar0l76kzuvrrcwj5um72u3pjq2uvp62aruf',
    mirrorStaking: 'terra17f7zu97865jmknk7p2glqvxzhduk78772ezac5',
    mirrorGov: 'terra1wh39swv7nq36pnefnupttm2nr96kz7jjddyt2x',
    mirrorToken: 'terra15gwkyepfc6xgca5t5zefzwy42uts8l2m4g40k6',
    specFarm: 'terra17hjvrkcwn3jk2qf69s5ldxx5rjccchu35assga',
    terraSwapFactory: 'terra1ulgw0td86nvs4wtpsc80thv6xelk76ut7a7apj',
    staker: 'terra1fxwelge6mf5l6z0rjpylzcfq9w9tw2q7tewaf5',
    lcd: 'https://lcd.terra.dev',
    fcd: 'https://fcd.terra.dev',
    mirrorGraph: 'mirror',
    chainID: 'columbus-4',
  },
  testnet: {
    specToken: 'terra1kvsxd94ue6f4rtchv2l6me5k07uh26s7637cza',
    specPool: 'terra15cjce08zcmempedxwtce2y44y2ayup8gww3txr',
    specLpToken: 'terra1ntt4mdhr9lukayenntgltqppw4yy6hts7wr67d',
    gov: 'terra1x3l2tkkwzzr0qsnrpy3lf2cm005zxv7pun26x4',
    mirrorFarm: 'terra1hasdl7l6xtegnch8mjyw2g7mfh9nt3gtdtmpfu',
    mirrorStaking: 'terra1a06dgl27rhujjphsn4drl242ufws267qxypptx',
    mirrorGov: 'terra12r5ghc6ppewcdcs3hkewrz24ey6xl7mmpk478s',
    mirrorToken: 'terra10llyp6v3j3her8u3ce66ragytu45kcmd9asj3u',
    specFarm: 'terra1cedx8gpvu7c4vzfadwmf3pewg2030fqgw4q3dl',
    terraSwapFactory: 'terra18qpjm4zkvqnpjpw0zn0tdr8gdzvt8au35v45xf',
    staker: 'terra15nwqmmmza9y643apneg0ddwt0ekk38qdevnnjt',
    lcd: 'https://tequila-lcd.terra.dev',
    fcd: 'https://tequila-fcd.terra.dev',
    mirrorGraph: 'mirrorTest',
    chainID: 'tequila-0004',
  },
};
