import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, LOCALE_ID, NgModule, ɵLocaleDataIndex } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { VaultComponent } from './pages/vault/vault.component';
import { MenubarComponent } from './menubar/menubar.component';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { ModalComponent } from './services/modal/modal.component';
import { NotifyComponent } from './services/notify/notify.component';
import { LoaderComponent } from './services/loader/loader.component';
import { GovComponent } from './pages/gov/gov.component';
import { PollItemComponent } from './pages/gov/poll-item/poll-item.component';
import { TerrajsService } from './services/terrajs.service';
import { DigitComponent } from './components/digit/digit.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaxValidator } from './directives/max.directive';
import { MinValidator } from './directives/min.directive';
import { GovPollNewComponent } from './pages/gov-poll-new/gov-poll-new.component';
import { AutofocusDirective } from './directives/autofocus.directive';
import { JsonValidator } from './directives/json.directive';
import { GovPollDetailComponent } from './pages/gov-poll-detail/gov-poll-detail.component';
import { TruncatePipe } from './pipes/truncate.pipe';
import { TimeagoPipe } from './pipes/timeago.pipe';
import { ShortNumPipe } from './pipes/short-num.pipe';
import { DecimalPipe, NumberFormatStyle, NumberSymbol, registerLocaleData } from '@angular/common';
import { PrettyJsonModule } from 'angular2-prettyjson';
import { JsonParsePipe } from './pipes/json-parse.pipe';
import { TxPostComponent } from './services/tx-post/tx-post.component';
import locale from '@angular/common/locales/en';
import { TradeComponent } from './pages/trade/trade.component';
import { AssetCardComponent } from './pages/vault/asset-card/asset-card.component';
import { VaultDialogComponent } from './pages/vault/asset-card/vault-dialog/vault-dialog.component';
import { GraphQLModule } from './graphql.module';
import { UrlPipe } from './pipes/url.pipe';
import { UnitPipe } from './pipes/unit.pipe';
import { FARM_INFO_SERVICE } from './services/farm_info/farm-info.service';
import { MirrorFarmInfoService } from './services/farm_info/mirror.farm-info.service';
import { SpecFarmInfoService } from './services/farm_info/spec.farm-info.service';
import { RewardInfoPipe } from './pipes/reward-info.pipe';
import { NgxGoogleAnalyticsModule, NgxGoogleAnalyticsRouterModule } from 'ngx-google-analytics';
import { CONFIG } from './consts/config';
import { FooterComponent } from './footer/footer.component';
import { LpSplitPipe } from './pipes/lp-split.pipe';
import { PricePipe } from './pipes/price.pipe';
import { ToDatePipe } from './pipes/to-date.pipe';
import { BalancePipe } from './pipes/balance.pipe';
import { LpBalancePipe } from './pipes/lp-balance.pipe';
import { AnchorFarmInfoService } from './services/farm_info/anchor.farm-info.service';
import { ConnectOptionsComponent } from './services/connect-options/connect-options.component';
import { WalletOptionsComponent } from './services/wallet-options/wallet-options.component';
import { TxHistoryComponent } from './pages/tx-history/tx-history.component';
import { YourTvlComponent } from './pages/vault/your-tvl/your-tvl.component';
import { UnstakeAllComponent } from './pages/vault/unstake-all/unstake-all.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { PylonFarmInfoService } from './services/farm_info/pylon.farm-info.service';
import { GovPoolComponent } from './pages/gov/gov-pool/gov-pool.component';
import {NgxSliderModule} from '@angular-slider/ngx-slider';
import { FloorPipe } from './pipes/floor.pipe';
import {TerraworldFarmInfoService} from './services/farm_info/terraworld.farm-info.service';
import { ValkyrieFarmInfoService } from './services/farm_info/valkyrie.farm-info.service';
import {NexusFarmInfoService} from './services/farm_info/nexus.farm-info.service';
import {OrionFarmInfoService} from './services/farm_info/orion.farm-info.service';
import { ManageRewardsComponent } from './pages/vault/manage-rewards/manage-rewards.component';
import {NlunaPsiFarmInfoService} from './services/farm_info/nluna-psi.farm-info.service';
import {NethPsiFarmInfoService} from './services/farm_info/neth-psi.farm-info.service';
import {MdbTooltipModule} from 'mdb-angular-ui-kit/tooltip';
import {MdbDropdownModule} from 'mdb-angular-ui-kit/dropdown';
import {MdbTabsModule} from 'mdb-angular-ui-kit/tabs';
import {MdbCollapseModule} from 'mdb-angular-ui-kit/collapse';
import {MdbFormsModule} from 'mdb-angular-ui-kit/forms';
import {MdbValidationModule} from 'mdb-angular-ui-kit/validation';
import {MdbModalService} from 'mdb-angular-ui-kit/modal';
import { LpEarningPipe } from './pipes/lp-earning.pipe';
import {BPsiDPFarmInfoService} from './services/farm_info/bPsiDP.farm-info.service';
import {MockAstroportAnchorFarmInfoService} from './services/farm_info/mock-astroport-anchor.farm-info.service';
import {MockAstroportAstroUstFarmInfoService} from './services/farm_info/mock-astroport-astro-ust.farm-info.service';

// alter default decimal to 6
locale[ɵLocaleDataIndex.NumberFormats][NumberSymbol.Decimal] = '#,##0.######';
locale[ɵLocaleDataIndex.NumberFormats][NumberFormatStyle.Percent] = '#,##0.##%';
registerLocaleData(locale, 'en');

@NgModule({
  declarations: [
    AppComponent,
    VaultComponent,
    MenubarComponent,
    FooterComponent,
    ModalComponent,
    NotifyComponent,
    LoaderComponent,
    GovComponent,
    PollItemComponent,
    DigitComponent,
    MaxValidator,
    MinValidator,
    GovPollNewComponent,
    AutofocusDirective,
    JsonValidator,
    GovPollDetailComponent,
    TruncatePipe,
    TimeagoPipe,
    ShortNumPipe,
    JsonParsePipe,
    TxPostComponent,
    // StepDirective,
    TradeComponent,
    AssetCardComponent,
    UrlPipe,
    UnitPipe,
    RewardInfoPipe,
    LpSplitPipe,
    PricePipe,
    ToDatePipe,
    BalancePipe,
    LpBalancePipe,
    ConnectOptionsComponent,
    WalletOptionsComponent,
    TxHistoryComponent,
    YourTvlComponent,
    UnstakeAllComponent,
    GovPoolComponent,
    FloorPipe,
    ManageRewardsComponent,
    VaultDialogComponent,
    LpEarningPipe,
  ],
  imports: [
    AppRoutingModule,
    BrowserAnimationsModule,
    BrowserModule,
    ClipboardModule,
    FormsModule,
    HttpClientModule,
    ReactiveFormsModule,
    PrettyJsonModule,
    GraphQLModule,
    NgxGoogleAnalyticsModule.forRoot(CONFIG.GOOGLE_ANALYTICS_ID),
    NgxGoogleAnalyticsRouterModule,
    NgxChartsModule,
    NgxSliderModule,
    MdbTooltipModule,
    MdbDropdownModule,
    MdbTabsModule,
    MdbCollapseModule,
    MdbFormsModule,
    MdbValidationModule,
  ],
  providers: [
    // { provide: HTTP_INTERCEPTORS, useClass: LoaderInterceptor, multi: true},
    MdbModalService,
    {
      provide: APP_INITIALIZER,
      useFactory: (terrajs: TerrajsService) => () => setTimeout(() => terrajs.connect(true), 1500),
      deps: [TerrajsService],
      multi: true
    },
    { provide: FARM_INFO_SERVICE, useClass: SpecFarmInfoService, multi: true },
    { provide: FARM_INFO_SERVICE, useClass: MockAstroportAstroUstFarmInfoService, multi: true },
    { provide: FARM_INFO_SERVICE, useClass: MockAstroportAnchorFarmInfoService, multi: true },
    { provide: FARM_INFO_SERVICE, useClass: AnchorFarmInfoService, multi: true },
    // { provide: FARM_INFO_SERVICE, useClass: KujiraFarmInfoService, multi: true },
    { provide: FARM_INFO_SERVICE, useClass: MirrorFarmInfoService, multi: true },
    { provide: FARM_INFO_SERVICE, useClass: NexusFarmInfoService, multi: true },
    { provide: FARM_INFO_SERVICE, useClass: NlunaPsiFarmInfoService, multi: true },
    // { provide: FARM_INFO_SERVICE, useClass: NethPsiFarmInfoService, multi: true },
    // { provide: FARM_INFO_SERVICE, useClass: OrionFarmInfoService, multi: true },
    // { provide: FARM_INFO_SERVICE, useClass: PylonFarmInfoService, multi: true },
    // { provide: FARM_INFO_SERVICE, useClass: BPsiDPFarmInfoService, multi: true },
    // { provide: FARM_INFO_SERVICE, useClass: TerraworldFarmInfoService, multi: true },
    { provide: FARM_INFO_SERVICE, useClass: ValkyrieFarmInfoService, multi: true },
    TruncatePipe,
    DecimalPipe,
    UnitPipe,
    BalancePipe,
    LpBalancePipe,
    { provide: LOCALE_ID, useValue: 'en' },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
