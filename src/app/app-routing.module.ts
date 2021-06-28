import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {VaultComponent} from './pages/vault/vault.component';
import { GovComponent } from './pages/gov/gov.component';
import { GovStakeComponent } from './pages/gov-stake/gov-stake.component';
import { GovPollNewComponent } from './pages/gov-poll-new/gov-poll-new.component';
import { GovPollDetailComponent } from './pages/gov-poll-detail/gov-poll-detail.component';
import {TradeComponent} from './pages/trade/trade.component';

const routes: Routes = [
  { path: 'vaults', component: VaultComponent },
  { path: 'trade', component: TradeComponent },
  { path: 'gov', component: GovComponent },
  { path: 'gov/stake', component: GovStakeComponent },
  { path: 'gov/unstake', component: GovStakeComponent },
  { path: 'gov/poll/new', component: GovPollNewComponent },
  { path: 'gov/poll/:id', component: GovPollDetailComponent },
  { path: '**', redirectTo: '/vaults' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule { }
