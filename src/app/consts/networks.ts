export interface ISettings {
  specToken: string;
  specPool: string;
  specLpToken: string;
  gov: string;
  austToken: string;
  anchorMarket: string;
  platform: string;
  warchest: string;
  wallet: string;
  mirrorFarm: string;
  mirrorStaking: string;
  mirrorGov: string;
  mirrorToken: string;
  specFarm: string;
  terraSwapFactory: string;
  terraSwapRouter: string;
  astroportFactory: string;
  staker: string;
  stakerSingleAsset: string;
  stakerAstroport: string;
  anchorGov: string;
  anchorStaking: string;
  anchorToken: string;
  anchorFarm: string;
  pylonGov: string;
  pylonStaking: string;
  pylonToken: string;
  pylonFarm: string;
  terraworldGov: string;
  terraworldStaking: string;
  terraworldToken: string;
  terraworldFarm: string;
  valkyrieGov: string;
  valkyrieStaking: string;
  valkyrieToken: string;
  valkyrieFarm: string;
  nexusGov: string;
  nexusStaking: string;
  nexusToken: string;
  nexusFarm: string;
  nLunaPsiStaking: string;
  nLunaToken: string;
  nLunaPsiFarm: string;
  nEthPsiStaking: string;
  nEthToken: string;
  nEthPsiFarm: string;
  orionGov: string;
  orionStaking: string;
  orionToken: string;
  orionFarm: string;
  bPsiDPFarm: string;
  bPsiDPGatewayPool: string;
  bPsiDPToken: string;
  psiDPGatewayPool: string;
  psiDPToken: string;
  astroToken: string;
  bLunaToken: string;
  astroportGov: string;
  astroportGenerator: string;
  astroportAstroUstFarm: string;
  astroportLunaUstFarm: string;
  astroportBlunaLunaFarm: string;
  lcd: string;
  fcd: string;
  querier: string;
  mirrorGraph: string;
  specAPI: string;
  anchorAPI: string;
  pylonAPI: string;
  valkyrieAPI: string;
  orionAPI: string;
  nexusGraph: string;
  chainID: string;
  finder: string;
  astroportAncUstFarm: string;
  astroportMirUstFarm: string;
  astroportOrionUstFarm: string;
  astroportSttUstFarm: string;
  astroportVkrUstFarm: string;
  astroportMineUstFarm: string;
  astroportApolloUstFarm: string;
  astroportPsiUstFarm: string;
  astroportNlunaPsiFarm: string;
  astroportNethPsiFarm: string;
  astroportXdefiUstFarm: string;
  astroportSayveUstFarm: string;
  astroportStlunaLunaFarm: string;
  astroportStsolUstFarm: string;
  astroportStethUstFarm: string;
  astroportStlunaLdoFarm: string;
  astroportStlunaLdoStaking: string;
  astroportMarsUstFarm: string;
  astroportOrneUstFarm: string;
  orneToken: string;
  marsToken: string;
  stlunaToken: string;
  stsolToken: string;
  stethToken: string;
  ldoToken: string;
  starterraToken: string;
  apolloToken: string;
  xdefiToken: string;
  sayveToken: string;
  apolloFactory: string;
  mirrorFactory: string;
  sttStaking: string;
  terraNameServiceGov: string;
  terraNameServiceStaking: string;
  terraNameServiceToken: string;
  terraNameServiceFarm: string;
  terraNameServiceLp: string;
  glowPool: string;
  glowToken: string;
  glowLp: string;
  glowStaking: string;
  glowGov: string;
  glowFarm: string;
  loterraGov: string;
  loterraStaking: string;
  loterraToken: string;
  loterraFarm: string;
  nLunaRewards: string;
  nETHRewards: string;
  nLunaFarm: string;
  nETHFarm: string;
  astroportRouter: string;
  specBorrowedFarm: string;
  specLeveragedFarm: string;
  // // batch only
  // lcdPost: string;
  // controller: string;
  // gql_mirror: string;
  // gql_nexus: string;
  // astroportAstroUstLP: string;
  // astroportLunaUstLP: string;
  // astroportBlunaLunaLP: string;
  burnVaultController: string;
  burnVault: string;
  // astroportAncUstLP: string;
  // astroportMirUstLP: string;
  // astroportOrionUstLP: string;
  // astroportSttUstLP: string;
  // astroportVkrUstLP: string;
  // astroportMineUstLP: string;
  // astroportApolloUstLP: string;
  tnsReverseRecord: string;
}

export const networks: Record<string, ISettings> = {
  mainnet: {
    specToken: 'terra1s5eczhe0h0jutf46re52x5z4r03c8hupacxmdr',
    specPool: 'terra1tn8ejzw8kpuc87nu42f6qeyen4c7qy35tl8t20',
    specLpToken: 'terra1y9kxxm97vu4ex3uy0rgdr5h2vt7aze5sqx7jyl',
    gov: 'terra1dpe4fmcz2jqk6t50plw0gqa2q3he2tj6wex5cl',
    austToken: 'terra1hzh9vpxhsk8253se0vv5jj6etdvxu3nv8z07zu',
    anchorMarket: 'terra1sepfj7s0aeg5967uxnfk4thzlerrsktkpelm5s',
    platform: 'terra1vvu80qnl0yn94stkc9sy2f5xcqcscu2fercgzq',
    warchest: 'terra14v8aeq4289fk7z08jvaw3qu3hers6whrdkqffp',
    wallet: 'terra1dretwqx84u229rjfgkp0j6avc3fusp000ejrz9',
    mirrorFarm: 'terra1kehar0l76kzuvrrcwj5um72u3pjq2uvp62aruf',
    mirrorStaking: 'terra17f7zu97865jmknk7p2glqvxzhduk78772ezac5',
    mirrorGov: 'terra1wh39swv7nq36pnefnupttm2nr96kz7jjddyt2x',
    mirrorToken: 'terra15gwkyepfc6xgca5t5zefzwy42uts8l2m4g40k6',
    specFarm: 'terra17hjvrkcwn3jk2qf69s5ldxx5rjccchu35assga',
    terraSwapFactory: 'terra1ulgw0td86nvs4wtpsc80thv6xelk76ut7a7apj',
    terraSwapRouter: 'terra19qx5xe6q9ll4w0890ux7lv2p4mf3csd4qvt3ex',
    astroportFactory: 'terra1fnywlw4edny3vw44x04xd67uzkdqluymgreu7g',
    staker: 'terra1fxwelge6mf5l6z0rjpylzcfq9w9tw2q7tewaf5',
    stakerSingleAsset: 'terra12kzevdnqe4k82cg5f07dywgj4lvkshhhwh4gnc',
    stakerAstroport: 'terra1w9d33yf2j05m2h6f3k7sjuhgrdrznqmncjrwhq',
    anchorGov: 'terra1f32xyep306hhcxxxf7mlyh0ucggc00rm2s9da5',
    anchorStaking: 'terra1897an2xux840p9lrh6py3ryankc6mspw49xse3',
    anchorToken: 'terra14z56l0fp2lsf86zy3hty2z47ezkhnthtr9yq76',
    anchorFarm: 'terra1fqzczuddqsdml37a20pysjx5wk9dh4tdzu2mrw',
    pylonGov: 'terra1xu8utj38xuw6mjwck4n97enmavlv852zkcvhgp',
    pylonStaking: 'terra19nek85kaqrvzlxygw20jhy08h3ryjf5kg4ep3l',
    pylonToken: 'terra1kcthelkax4j9x8d3ny6sdag0qmxxynl3qtcrpy',
    pylonFarm: 'terra1r3675psl7s2fe0sfh0vut5z4hrywgyyfdrzg95',
    terraworldGov: 'terra1l709gpyzpwukpq3g55j7n8kqyzataxlg4swg96',
    terraworldStaking: 'terra10eyxljyqkcvhs4dgr534hk0wehc28tz6gwnh8a',
    terraworldToken: 'terra19djkaepjjswucys4npd5ltaxgsntl7jf0xz7w6',
    terraworldFarm: 'terra1cdyw7fydevn372re7xjgfh8kqrrf2lxm5k6ve3',
    valkyrieGov: 'terra1w6xf64nlmy3fevmmypx6w2fa34ue74hlye3chk',
    valkyrieStaking: 'terra1ude6ggsvwrhefw2dqjh4j6r7fdmu9nk6nf2z32',
    valkyrieToken: 'terra1dy9kmlm4anr92e42mrkjwzyvfqwz66un00rwr5',
    valkyrieFarm: 'terra1xt4ugaxds6wjehjckqchzg4e99n3cjd2rtfw4f',
    nexusGov: 'terra1xrk6v2tfjrhjz2dsfecj40ps7ayanjx970gy0j',
    nexusStaking: 'terra12kzewegufqprmzl20nhsuwjjq6xu8t8ppzt30a',
    nexusToken: 'terra12897djskt9rge8dtmm86w654g7kzckkd698608',
    nexusFarm: 'terra1j2hdp4jelqe9tkfwnsx5mlheqagaryxhqwr4h2',
    nLunaPsiStaking: 'terra1hs4ev0ghwn4wr888jwm56eztfpau6rjcd8mczc',
    nLunaToken: 'terra10f2mt82kjnkxqj2gepgwl637u2w4ue2z5nhz5j', // nLunaPsiLP: 'terra1tuw46dwfvahpcwf3ulempzsn9a0vhazut87zec'
    nLunaPsiFarm: 'terra19kzel57gvx42e628k6frh624x5vm2kpck9cr9c',
    nEthPsiStaking: 'terra1lws09x0slx892ux526d6atwwgdxnjg58uan8ph', // nEthPsiLP: 'terra1y8kxhfg22px5er32ctsgjvayaj8q36tr590qtp'
    nEthToken: 'terra178v546c407pdnx5rer3hu8s2c0fc924k74ymnn',
    nEthPsiFarm: 'terra1lmm7xjareer3fd040kz2epw93hg20p9f64uh98',
    orionGov: 'terra135mjmscm37mp5tu5ghp00lp374fsjaqksmjfh8',
    orionStaking: 'terra1q8q6y03452e44pztw8kr8zcdkjtxuz8vq9t8uq',
    orionToken: 'terra1mddcdx0ujx89f38gu7zspk2r2ffdl5enyz2u03', // orionLP terra14ffp0waxcck733a9jfd58d86h9rac2chf5xhev
    orionFarm: 'terra106en784zr4kpe6phlaj8c8t3aeqgn3xsugaelx',
    bPsiDPFarm: 'terra1kr82wxlvg773vjay95epyckna9g4vppjyfxgd0',
    bPsiDPGatewayPool: 'terra1fmnedmd3732gwyyj47r5p03055mygce98dpte2', // what is terra12k0p3qvfhy6j5e3ef8kzusy29lzwykk5d95kk5
    bPsiDPToken: 'terra1zsaswh926ey8qa5x4vj93kzzlfnef0pstuca0y', // Pylon Psi-bPsiDP-24m Pair terra167gwjhv4mrs0fqj0q5tejyl6cz6qc2cl95z530
    psiDPGatewayPool: 'terra1xu84jh7x2ugt3gkpv8d450hdwcyejtcwwkkzgv',
    psiDPToken: 'terra1rzj8fua8wmqq7x0ka8emr6t7n9j45u82pe6sgc',
    astroToken: 'terra1xj49zyqrwpv5k928jwfpfy2ha668nwdgkwlrg3',
    bLunaToken: 'terra1kc87mu460fwkqte29rquh4hc20m54fxwtsx7gp',
    xdefiToken: 'terra169edevav3pdrtjcx35j6pvzuv54aevewar4nlh',
    astroportGov: 'terra1f68wt2ch3cx2g62dxtc8v68mkdh5wchdgdjwz7',
    astroportGenerator: 'terra1zgrx9jjqrfye8swykfgmd6hpde60j0nszzupp9',
    astroportAstroUstFarm: 'terra1wn0d0zwl382pnl6hdcd8r926yx6mcqcag7v39j',
    astroportLunaUstFarm: 'terra1egstlx9c9pq5taja5sg0yhraa0cl5laxyvm3ln',
    astroportBlunaLunaFarm: 'terra1ejl4v53w4all7zkw8nfkw2q6d3qkpls8m4cav4',
    astroportAncUstFarm: 'terra1ukm33qyqx0qcz7rupv085rgpx0tp5wzkhmcj3f',
    astroportMirUstFarm: 'terra1y5hd5ea9dshfwf5eysqtsey7qkdhhktmtw9y3q',
    astroportOrionUstFarm: 'terra1p30zk5xfn34lygcyhs2us9mxwzsn88v2yqrcw6',
    astroportSttUstFarm: 'terra10htnzp8gk49u97whehd9uuj5rl2keegcvdhg2q',
    astroportVkrUstFarm: 'terra1yj34w2n24p4x7s69evjp7ukzz82ca5tvlzqa84',
    astroportMineUstFarm: 'terra1s9zqk5ksnwp8qywrmdwt2fq0a9l0zc2d2sw2an',
    astroportApolloUstFarm: 'terra1zngkjhqqearpfhym9x9hnutpklduz45e9uvp9u',
    astroportPsiUstFarm: 'terra1jxh7hahwxlsy5cckkyhuz50a60mpn5tr0px6tq',
    astroportNlunaPsiFarm: 'terra1zl3ud44lja3r8ld8nwzh3eukl6h97gp2xr4wq6',
    astroportNethPsiFarm: 'terra1xw3jzqwrql5fvddchzxycd2ygrep5kudsden5c',
    astroportXdefiUstFarm: 'terra1d9cufxz9a4px9zfzq8quqewlj24durtu6lhwfw',
    astroportSayveUstFarm: 'terra1mr9xlwydgg0lfxvy68ylxuchzy6jdn706vwu8c',
    astroportStlunaLunaFarm: 'terra19dfth8559etgnqmnu9nwd87pjqsuufswwclcav',
    astroportStsolUstFarm: 'terra1puxzzlcr2urp4pvx523xhq593tgpt7damnm6pc',
    astroportStethUstFarm: 'terra12td8as6zhm3m9djjmpxzfue9syvrj0ewe070hf',
    astroportStlunaLdoFarm: 'terra1aeaz2w7gxu7ga8fj76mna8skhvq6ft0q0x42tv',
    astroportStlunaLdoStaking: 'terra10t8rn7swtkmkfm56mmxwmk2v9xrv78fljsd3ez',
    astroportMarsUstFarm: 'terra1d55nmhuq75r3vf93hwkau2stts4mpe9h22herz',
    astroportOrneUstFarm: 'terra19adzxnzdgmpm3jelxjw0d2h635cuymemsvtp5n',
    orneToken: 'terra1hnezwjqlhzawcrfysczcxs6xqxu2jawn729kkf',
    marsToken: 'terra12hgwnpupflfpuual532wgrxu2gjp0tcagzgx4n',
    stlunaToken: 'terra1yg3j2s986nyp5z7r2lvt0hx3r0lnd7kwvwwtsc', // decimal 6
    stsolToken: 'terra1t9ul45l7m6jw6sxgvnp8e5hj8xzkjsg82g84ap', // decimal 8
    stethToken: 'terra133chr09wu8sakfte5v7vd8qzq9vghtkv4tn0ur', // decimal 8
    ldoToken: 'terra1jxypgnfa07j6w92wazzyskhreq2ey2a5crgt6z', // decimal 8
    starterraToken: 'terra13xujxcrc9dqft4p9a8ls0w3j0xnzm6y2uvve8n',
    sayveToken: 'terra14v9wrjs55qsn9lkvylsqela3w2ytwxzkycqzcr',
    sttStaking: 'terra15p807wnm9q3dyw4rvfqsaukxqt6lkuqe62q3mp',
    terraNameServiceGov: 'terra1a5thpf2gdrrneewjkutyz5q6zr2kn8ymg0cxn9',
    terraNameServiceStaking: 'terra1u94zwrreyz3t0jx25nl7800pxsrk6e6dwjqpsx', // tns pool terra1hqnk9expq3k4la2ruzdnyapgndntec4fztdyln
    terraNameServiceToken: 'terra14vz4v8adanzph278xyeggll4tfww7teh0xtw2y', // tns lp terra1kg9vmu4e43d3pz0dfsdg9vzwgnnuf6uf3z9jwj
    terraNameServiceFarm: 'terra1qanglh8qpeqltp60ktwmkl938lm9etz5s4hkh6',
    terraNameServiceLp: 'terra1kg9vmu4e43d3pz0dfsdg9vzwgnnuf6uf3z9jwj',
    glowPool: 'terra1p44kn7l233p7gcj0v3mzury8k7cwf4zt6gsxs5',
    glowToken: 'terra13zx49nk8wjavedjzu8xkk95r3t0ta43c9ptul7',
    glowLp: 'terra1khm4az2cjlzl76885x2n7re48l9ygckjuye0mt',
    glowStaking: 'terra1le3a67j4khkjhyytkllxre60dvywm43ztq2s8t',
    glowGov: 'terra1xxp34xk4rjexwlu0xfdhyn0zr3qsgare04yll0',
    glowFarm: 'terra1u6f5vnux869rnextxypjdyrvnvcaux68nr6nne',
    loterraGov: 'terra1342fp86c3z3q0lksq92lncjxpkfl9hujwh6xfn',
    loterraStaking: 'terra1pdslh858spzqrtx2gwr69pzm9m2wrv55aeh742',
    loterraToken: 'terra1ez46kxtulsdv07538fh5ra5xj8l68mu8eg24vr',
    loterraFarm: 'terra1msy2na2lvf64qffelg5t633f6wzlf03t5uvl8f',
    nLunaRewards: 'terra1hjv3quqsrw3jy7pulgutj0tgxrcrnw2zs2j0k7',
    nETHRewards: 'terra1fhqsu40s0lk3p308mcakzjecj6ts6j2guepfr4',
    nLunaFarm: 'terra16usjvptlpdrj7hcmy7mvdap5tttzcya7ch0can',
    nETHFarm: 'terra1gvlll4hytc9s34dskw5ym86erx3hx2j6sa8zhy',
    astroportRouter: 'terra16t7dpwwgx9n3lq6l6te3753lsjqwhxwpday9zx',
    specBorrowedFarm: '',
    // lcd: 'https://lcd.terra.dev',
    lcd: 'https://node2.spec.finance',
    specLeveragedFarm: '',
    fcd: 'https://fcd.terra.dev',
    querier: 'terra1kwk8xzc3ag5e02mzdvrqafwtjncnpypsnuxztf',
    mirrorGraph: 'mirror',
    specAPI: 'https://specapi.azurefd.net/api',
    anchorAPI: 'https://api.anchorprotocol.com/api/v2',
    pylonAPI: 'https://api.pylon.money',
    valkyrieAPI: 'https://api.valkyrieprotocol.com',
    orionAPI: 'https://api.orion.money/v1/terra',
    nexusGraph: 'nexus',
    chainID: 'columbus-5',
    finder: 'finder.extraterrestrial.money',
    apolloToken: 'terra100yeqvww74h4yaejj6h733thgcafdaukjtw397',
    apolloFactory: 'terra1g7jjjkt5uvkjeyhp8ecdz4e4hvtn83sud3tmh2',
    mirrorFactory: 'terra1mzj9nsxx0lxlaxnekleqdy8xnyw2qrh3uz6h8p',
    burnVaultController: 'terra12f4h5sk0mfmrvectgw3nns56rlp9za9z0hvvvv',
    burnVault: 'terra1gyqyhjppy3k77wltnmqt29ms340mmayk7ank4e',
    tnsReverseRecord: 'terra13efj2whf6rm7yedc2v7rnz0e6ltzytyhydy98a',
  },
  testnet: {
    specToken: 'terra1kvsxd94ue6f4rtchv2l6me5k07uh26s7637cza',
    specPool: 'terra15cjce08zcmempedxwtce2y44y2ayup8gww3txr',
    specLpToken: 'terra1ntt4mdhr9lukayenntgltqppw4yy6hts7wr67d',
    gov: 'terra1x3l2tkkwzzr0qsnrpy3lf2cm005zxv7pun26x4',
    austToken: 'terra1ajt556dpzvjwl0kl5tzku3fc3p3knkg9mkv8jl',
    anchorMarket: 'terra15dwd5mj8v59wpj0wvt233mf5efdff808c5tkal',
    platform: 'terra10h22vx3kp8wxdkuhypmwnjr4wrurcup5pk9uq9',
    warchest: 'terra1ulpamdq7lsg5hu0hzvl4skxt0ahtxs0enyu96e',
    wallet: 'terra1u4kg5h8zrwvtr30h2hwhnj64ekml4uar65plvm',
    mirrorFarm: 'terra1hasdl7l6xtegnch8mjyw2g7mfh9nt3gtdtmpfu',
    mirrorStaking: 'terra1a06dgl27rhujjphsn4drl242ufws267qxypptx',
    mirrorGov: 'terra12r5ghc6ppewcdcs3hkewrz24ey6xl7mmpk478s',
    mirrorToken: 'terra10llyp6v3j3her8u3ce66ragytu45kcmd9asj3u',
    specFarm: 'terra1cedx8gpvu7c4vzfadwmf3pewg2030fqgw4q3dl',
    terraSwapFactory: 'terra18qpjm4zkvqnpjpw0zn0tdr8gdzvt8au35v45xf',
    terraSwapRouter: 'terra14z80rwpd0alzj4xdtgqdmcqt9wd9xj5ffd60wp',
    astroportFactory: 'terra15jsahkaf9p0qu8ye873p0u5z6g07wdad0tdq43',
    staker: 'terra15nwqmmmza9y643apneg0ddwt0ekk38qdevnnjt',
    stakerSingleAsset: 'terra1xt7p5a5dezj4d5h4rhry6mr6khhfhgnszem08s',
    stakerAstroport: 'terra14lezmh3d449pu8hfhwpxu5wu694l4tzg3lhru5',
    anchorGov: 'terra16ckeuu7c6ggu52a8se005mg5c0kd2kmuun63cu',
    anchorStaking: 'terra19nxz35c8f7t3ghdxrxherym20tux8eccar0c3k',
    anchorToken: 'terra1747mad58h0w4y589y3sk84r5efqdev9q4r02pc',
    anchorFarm: 'terra1yvpd3j7mry7qrmmn2x9vapmr9qpzkvjgs4f7z7',
    pylonGov: 'terra1hffjqjscxgz5lnmmtwhksrcg4gd3x4nyp9mzwx',
    pylonStaking: 'terra17av0lfhqymusm6j9jpepzerg6u54q57jp7xnrz',
    pylonToken: 'terra1lqm5tutr5xcw9d5vc4457exa3ghd4sr9mzwdex',
    pylonFarm: 'terra1hgjp2yjqe7ngzsx283tm7ch8xcsvk5c8mdj2tw',
    terraworldGov: 'terra1k7tsz2m2hnutx074gcwk9dtaxd88pywm6t8qul',
    terraworldStaking: 'terra155yqhchyvfkxz5tas07kvprx77wnla7stexhs7',
    terraworldToken: 'terra1pe803vgyesmqr73j3l4732hmg2v6ss374aagx4',
    terraworldFarm: 'terra19w0a2xv7vyj8yze3fxzk55nfl5nlvc0l67uduu',
    valkyrieGov: 'terra102jsr0c2d5nhaa8vmjw0nerphw0s2cs70tz9a3',
    valkyrieStaking: 'terra1pemp0pyupazlfye0cuxn0cz93mu02p8m5uep3k',
    valkyrieToken: 'terra1a8hskrwnccq0v7gq3n24nraaqt7yevzy005uf5',
    valkyrieFarm: 'terra15u4nuq7jchdzklpeqzazxs09cylgndqc37tvhg',
    nexusGov: 'terra1u7tnl4326ge86mzqeqnzxxjg7xkgj8nfg65a2h',
    nexusStaking: 'terra1qsc7y8448payj9fyjxn6ffxxmdcj5g5dtptfq2',
    nexusToken: 'terra18nle009rtynpjgleh2975rleu5zts0zdtqryte',
    nexusFarm: 'terra158j75d7kml99u3r4xy4e7xnfzmhm2j780e5npl',
    nLunaPsiStaking: 'terra14r89lj2e87qz2vwmdjxs70khh89n3w2xy2zkgn',
    nLunaToken: 'terra1gzq2zd4skvnvgm2z48fdp0mxy2djmtk7sz4uhe', // nLunaPsiLP: 'terra1a7awn36j2yy7jvy8te72rwrhl6zma3yugtrhm5'
    nLunaPsiFarm: 'terra1jssrzhcr2qdm53qucw6ty35wddyhea8nvwwq4a',
    nEthPsiStaking: 'terra1u8gvskrt5n6vdeeuc4428pxhjh75h0jcntm7ca',
    nEthToken: 'terra1em8dvzln8quptj9tuptf8tu73jyuv5jn6kqdwv', // nEthPsiLP: 'terra1y2r544tw2q4cgpgjvts8uu6gekk9kwz047a9sl'
    nEthPsiFarm: 'terra1nvgz56np9kytg4xx8xmd85yqfjh50p39wua2yg',
    orionGov: 'terra1xamqmmllxwhenagfn57753w9hqdhck43dzwj94',
    orionStaking: 'terra1jz22ws2yhlm6zycz7eluqptjn2t74fw4g82v8j',
    orionToken: 'terra13qdskca8xavmed88htplse0z396tesgh63tn9r', // orionLP terra1qvmf8jf3a7h6lgglw29f8nvcckn7t8z0hqgma5
    orionFarm: 'terra1mset93yy46n8lwy59gadcmekxspnf3zldzsc0x',
    bPsiDPFarm: 'terra1h909lafatcmxeqzgw030xudx965j7ulud5fwmm',
    bPsiDPGatewayPool: 'terra1w733k9ss5yglaluv7ueq3tlgfgq574nzhvq4v5', // TestPsi terra1ul5hkaxsapr3sr80f6ypygr9jgnfw5m7rfsfhy
    bPsiDPToken: 'terra1ex8ss7xhwcf8x6n47dn656hf8t0cw97myjr35a',
    psiDPGatewayPool: 'terra1zd8q7wltywdd90x2skvexh06p6r8mwljfqx4eu',
    psiDPToken: 'terra1c6vsshlv5gqtwq48darkunnpxu5ustcv96e0qk',
    astroToken: 'terra1jqcw39c42mf7ngq4drgggakk3ymljgd3r5c3r5', // xAstro terra14lpnyzc9z4g3ugr4lhm8s4nle0tq8vcltkhzh7
    bLunaToken: '',
    xdefiToken: '',
    astroportGov: 'terra1h2smqfg9lmemewwde9a4vf8fcp6z8666kxdhzh',
    astroportGenerator: 'terra1gjm7d9nmewn27qzrvqyhda8zsfl40aya7tvaw5',
    astroportAstroUstFarm: 'terra19x7u7d837p9x6rzwesnk65n3aml0p3apytz4d2',
    astroportLunaUstFarm: '',
    astroportBlunaLunaFarm: '',
    astroportAncUstFarm: 'terra1salzgw4879x45rduugn88j8x2mv6hzjdvwfmzh',
    astroportMirUstFarm: '',
    astroportOrionUstFarm: '',
    astroportSttUstFarm: '',
    astroportVkrUstFarm: '',
    astroportMineUstFarm: '',
    astroportApolloUstFarm: '',
    astroportPsiUstFarm: 'terra1ghglcu2cvh67dgfrx0v36vmw6c3zlj4ve20ct7',
    astroportNlunaPsiFarm: 'terra1hawqk9fx5y95qhc3s6p6crklwpnas56dss08cy',
    astroportNethPsiFarm: 'terra1zjp0gkz8gqan8ftjmvrtzzertuwywwj3z7yrwv',
    astroportXdefiUstFarm: '',
    astroportSayveUstFarm: '',
    astroportStlunaLunaFarm: '',
    astroportStsolUstFarm: '',
    astroportStethUstFarm: '',
    astroportStlunaLdoFarm: '',
    astroportStlunaLdoStaking: '',
    astroportMarsUstFarm: '',
    astroportOrneUstFarm: '',
    orneToken: '',
    marsToken: '',
    stlunaToken: '',
    stsolToken: '',
    stethToken: '',
    ldoToken: '',
    starterraToken: '',
    sayveToken: '',
    apolloToken: '',
    apolloFactory: '',
    sttStaking: '',
    terraNameServiceGov: 'terra1hdps6vdnknhr72vn99uqqvmmsn9c43en6vq26z',
    terraNameServiceStaking: 'terra1g9s3az3ra8uayvpm0zgj5mpx927et9mlqwfjfu', // tns pool terra12l4yfytser4hkezsq4g23st2a0ntgletukwxpw
    terraNameServiceToken: 'terra16qrvv9wukzzq0d7wxhkxrh5vv6m7lt770r0xts', // tns lp terra1cxt4rrstqhldhnwyzuk03jswx584e9w2xw896z
    terraNameServiceFarm: 'terra1ecd37frx3lan5evf7680h3nckjxynhfpz4edkc',
    terraNameServiceLp: 'terra1cxt4rrstqhldhnwyzuk03jswx584e9w2xw896z',
    glowPool: '',
    glowToken: '',
    glowLp: '',
    glowStaking: '',
    glowGov: '',
    glowFarm: '',
    loterraGov: '',
    loterraStaking: '',
    loterraToken: '',
    loterraFarm: '',
    nLunaRewards: 'terra17mr0kt7rzey0ycp2eypxnmtv9fjn7e3rc0yfuz',
    nETHRewards: 'terra1wf3tx75j2jg4ut7fa90rgze5etweqxgqlgq5su',
    nLunaFarm: 'terra1qrzu4zls2ep8drfmx2ul4fu9fu5qular9jlktl',
    nETHFarm: 'terra1zhdxsmpzpakrxcns00kyegpd8gsj4qvrahwj26',
    astroportRouter: 'terra13wf295fj9u209nknz2cgqmmna7ry3d3j5kv7t4',
    specBorrowedFarm: 'terra1jr9ctj9segzevwz6w7gmdc35jhcgxgsuqmrudy',
    specLeveragedFarm: 'terra1r2rtxhwj5fxzhj7tj3ek2dfdzqc8vcsf5z24ga',
    lcd: 'https://bombay-lcd.terra.dev',
    fcd: 'https://bombay-fcd.terra.dev',
    querier: 'terra16t9kkqa5esathvd0prw7v4zv5gsud2kvzj5qew',
    mirrorGraph: 'mirrorTest',
    specAPI: 'https://testapi.spec.finance/api',
    anchorAPI: 'https://api.anchorprotocol.com/api/v2',
    pylonAPI: 'https://api.dev.pylon.rocks',
    valkyrieAPI: 'https://api.testnet.valkyrieprotocol.com',
    orionAPI: 'https://api.orion.money/v1/terra', // orionAPI: 'https://api.stage.orion.money/v1/terra',
    nexusGraph: 'nexus',
    chainID: 'bombay-12',
    finder: 'finder.extraterrestrial.money',
    mirrorFactory: 'terra10l9xc9eyrpxd5tqjgy6uxrw7dd9cv897cw8wdr',
    burnVaultController: 'terra12f4h5sk0mfmrvectgw3nns56rlp9za9z0hvvvv',
    burnVault: 'terra1l3g2yv5cqwdtrxeun4a76jkq45gwwm682usvs4',
    tnsReverseRecord: 'terra13efj2whf6rm7yedc2v7rnz0e6ltzytyhydy98a',
  },
};
